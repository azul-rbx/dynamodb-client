import { AttributeValue, CreateTableArgs, DynamoDBClient } from "./client";
import { createTableIfNotExists, fromDynamoAttribute } from "./data_store";

function between(num: number, min: number, max: number) {
	return num >= min && num <= max;
}

class OrderedDataStorePage {
	IsFinished: boolean;
	private client: DynamoDBClient;
	private ascending: boolean;
	private pagesize: number;
	private minValue?: number;
	private maxValue?: number;
	private current_page: { key: string; value: number }[];
	private last_evaluated_key?: { [key: string]: AttributeValue };

	GetCurrentPage() {
		return this.current_page;
	}

	AdvanceToNextPageAsync() {
		this.Query();
	}

	private Query() {
		let result;
		if (this.minValue !== undefined && this.maxValue === undefined) {
		 	result = this.client.Query({
				TableName: "OrderedDataStore",
				IndexName: "gsi",
				ExpressionAttributeValues: {
					":TBL": {
						S: this.table_name
					},
					":MIN": {
						N: tostring(this.minValue)
					},
				},
				KeyConditionExpression: "table = :TBL AND value > :MIN",
				ExclusiveStartKey: this.last_evaluated_key,
				Limit: this.pagesize,
				ScanIndexForward: this.ascending,
			});
		} else if (this.maxValue !== undefined && this.minValue === undefined) {
			result = this.client.Query({
				TableName: "OrderedDataStore",
				IndexName: "gsi",
				ExpressionAttributeValues: {
					":TBL": {
						S: this.table_name
					},
					":MAX": {
						N: tostring(this.maxValue)
					}
				},
				KeyConditionExpression: "table = :TBL AND value < :MAX",
				ExclusiveStartKey: this.last_evaluated_key,
				Limit: this.pagesize,
				ScanIndexForward: this.ascending,
			});

		} else if (this.maxValue !== undefined && this.minValue !== undefined) {
			result = this.client.Query({
				TableName: "OrderedDataStore",
				IndexName: "gsi",
				ExpressionAttributeValues: {
					":TBL": {
						S: this.table_name
					},
					":MIN": {
						N: tostring(this.minValue)
					},
					":MAX": {
						N: tostring(this.maxValue)
					}
				},
				KeyConditionExpression: "table = :TBL AND value BETWEEN :MIN AND :MAX",
				ExclusiveStartKey: this.last_evaluated_key,
				Limit: this.pagesize,
				ScanIndexForward: this.ascending,
			});
		} else {
			result = this.client.Query({
				TableName: "OrderedDataStore",
				IndexName: "gsi",
				ExpressionAttributeValues: {
					":TBL": {
						S: this.table_name
					},
				},
				KeyConditionExpression: "table = :TBL",
				ExclusiveStartKey: this.last_evaluated_key,
				Limit: this.pagesize,
				ScanIndexForward: this.ascending,
			});
		}

		this.last_evaluated_key = result.LastEvaluatedKey;
		this.IsFinished = result.Count === 0;
		const items: { key: string; value: number }[] = [];
		print(result.Items);
		result.Items.forEach(x => {
			const { key, value } = x;
			items.push({ key: fromDynamoAttribute(key), value: fromDynamoAttribute(value) as number });
		});
		this.current_page = items;
	}

	constructor(
		readonly table_name: string,
		client: DynamoDBClient,
		ascending: boolean,
		pagesize: number,
		minValue?: number,
		maxValue?: number,
	) {
		this.client = client;
		this.ascending = ascending;
		this.pagesize = pagesize;
		this.minValue = minValue;
		this.maxValue = maxValue;
		this.IsFinished = false;
		this.current_page = [];
		this.Query();
	}
}

export class OrderedDataStore {
	client: DynamoDBClient;

	constructor(readonly table_name: string) {
		this.client = new DynamoDBClient({
			access_key_id: "None",
			secret_access_key: "None",
			region_name: "None",
			endpoint_url: "http://localhost:8000",
		});

		createTableIfNotExists(this.client, {
			AttributeDefinitions: [
				{
					AttributeName: "table",
					AttributeType: "S",
				},
				{
					AttributeName: "key",
					AttributeType: "S",
				},
				{
					AttributeName: "value",
					AttributeType: "N",
				},
			],
			BillingMode: "PAY_PER_REQUEST",
			TableName: "OrderedDataStore",
			KeySchema: [
				{
					AttributeName: "table",
					KeyType: "HASH",
				},
				{
					AttributeName: "key",
					KeyType: "RANGE",
				},
			],
			GlobalSecondaryIndexes: [
				{
					IndexName: "gsi",
					KeySchema: [
						{ AttributeName: "table", KeyType: "HASH" },
						{ AttributeName: "value", KeyType: "RANGE" },
					],
					Projection: {
						ProjectionType: "ALL",
					},
				},
			],
		});
	}

	GetSortedAsync(ascending: boolean, pagesize: number, minValue?: number, maxValue?: number): OrderedDataStorePage {
		return new OrderedDataStorePage(this.table_name, this.client, ascending, pagesize, minValue, maxValue);
	}

	// eslint-disable-next-line
	GetAsync(key: string): LuaTuple<[number | undefined, any]> {
		const [success, result] = pcall(() => {
			return this.client.GetItem({
				TableName: "OrderedDataStore",
				Key: {
					table: {
						S: this.table_name
					},
					key: {
						S: key,
					},
				},
			});
		});

		if (!success) {
			return $tuple(undefined, {});
		}

		const { Item } = result;
		assert(Item["value"]);
		assert(Item["value"]["N"]);
		return $tuple(tonumber(Item["value"]["N"])!, {});
	}

	RemoveAsync(key: string) {
		const value = this.GetAsync(key);
		this.client.DeleteItem({
			TableName: this.table_name,
			Key: {
				table: {
					S: this.table_name
				},
				key: {
					S: key,
				},
			},
		});
		return $tuple(value, {});
	}

	SetAsync(key: string, value: number) {
		if (type(value) !== "number") {
			error("Please pass a number to SetAsync");
		}
		if (value < 0) {
			error("Positive integer expected");
		}

		this.client.UpdateItem({
			TableName: "OrderedDataStore",
			ExpressionAttributeValues: {
				":V": {
					N: tostring(value)
				}
			},
			Key: {
				table: {
					S: this.table_name
				},
				key: {
					S: key,
				},
			},
			UpdateExpression: "SET value = :V"
		});

		// TODO: return the version id
		return 0;
	}

	UpdateAsync(key: string, update_fn: (value: number | undefined) => number | undefined) {
		const [value, _] = this.GetAsync(key);
		const updatedValue = update_fn(value);
		if (updatedValue === undefined) {
			return $tuple(value, {});
		}
		this.SetAsync(key, updatedValue);
		return $tuple(updatedValue, {});
	}

	IncrementAsync(key: string, increment: number) {
		const [value, _] = this.UpdateAsync(key, value => {
			if (type(value) === "nil") {
				return increment;
			}
			if (type(value) !== "number") {
				error("Key value was not an integer");
			}
			return (value as number) + increment;
		});

		return value;
	}
}
