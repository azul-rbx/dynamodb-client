import { AttributeValue, CreateTableArgs, DynamoDBClient } from "./client";

const createTableIfNotExists = (client: DynamoDBClient, args: CreateTableArgs) => {
	const [success, _] = pcall(() => {
		return client.DescribeTable({
			TableName: args.TableName,
		});
	});

	if (success) {
		return true;
	}

	return client.CreateTable(args);
};

type DynamoCoercibleAttributes = string |
  number |
  boolean |
  { [key: string]: DynamoCoercibleAttributes } |
  DynamoCoercibleAttributes[]

function toDynamoAttribute<S extends DynamoCoercibleAttributes | undefined>(input: S): AttributeValue {
  switch (type(input)) {
    case "boolean": {
      return {
        BOOL: input as boolean
      }
    }
    case "nil": {
      return {
        NULL: true
      }
    }
    case "string": {
      return {
        S: input as string
      }
    }
    case "number": {
      return {
        N: tostring(input as number)
      }
    }
    case "table": {
      if ((input as unknown[]).size() !== 0) {
        const inputArray: DynamoCoercibleAttributes[] = input as unknown as DynamoCoercibleAttributes[]; 
        return {
          L: inputArray.map(v => toDynamoAttribute(v))
        }
      }

      const map: { [key: string]: AttributeValue } = {};
      for (const [key, val] of pairs(input as { [key: string]: DynamoCoercibleAttributes }))
      {
        if (type(key) !== "string") {
          error("Cannot have non-string keys in a Dynamo map");
        }

        map[key] = toDynamoAttribute(val)
      }

      return {
        M: map
      }
    }
    default: error("unhandled type coercion");
  }
}

type AttributeValueMapping<S extends AttributeValue> = 
  S["S"] extends string ? string : 
  S["N"] extends string ? number :
  S["M"] extends { [key: string]: AttributeValue } ? { [key: string]: DynamoCoercibleAttributes } :
  S["L"] extends AttributeValue[] ? AttributeValue[] :
  S["BOOL"] extends boolean ? boolean :
  S["NULL"] extends true ? undefined :
  never;

function fromDynamoAttribute(input: AttributeValue): AttributeValueMapping<typeof input> {
  if (input.S !== undefined) {
    return input.S as AttributeValueMapping<typeof input>;
  }

  if (input.N !== undefined) {
    return tonumber(input.N!) as AttributeValueMapping<typeof input>;
  }

  if (input.M !== undefined) {
    const map: { [key: string]: DynamoCoercibleAttributes } = {};
    for (const [key, val] of pairs(input.M)) {
      map[key] = fromDynamoAttribute(val)
    }
    return map as AttributeValueMapping<typeof input>;
  }

  if (input.L !== undefined) {
    return input.L.map(x => fromDynamoAttribute(x)) as AttributeValueMapping<typeof input>
  }

  if (input.BOOL !== undefined) {
    return input.BOOL as AttributeValueMapping<typeof input>
  }

  if (input.NULL !== undefined) {
    if (input.NULL) {
      return undefined as AttributeValueMapping<typeof input>
    }
    error("expected true for null")
  }

  error("unhandled dynamo attribute");
}

export class DataStore {
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
					AttributeName: "key",
					AttributeType: "S",
				},
			],
			BillingMode: "PAY_PER_REQUEST",
			TableName: table_name,
			KeySchema: [
				{
					AttributeName: "key",
					KeyType: "HASH",
				},
			],
		});
	}

  private GetKeyWithVersion(key: string): LuaTuple<[DynamoCoercibleAttributes | undefined, number]> {
    const [success, result] = pcall(() => {
			return this.client.GetItem({
				TableName: this.table_name,
				Key: {
					key: {
						S: key,
					},
				},
			});
		});

		if (!success || result["Item"] === undefined) {
			return $tuple(undefined, 0);
		}

		const { Item } = result;
		assert(Item["value"]);
		assert(Item["value"]["L"]);
		const versions = Item["value"].L!;
    return $tuple(fromDynamoAttribute(versions[versions.size() - 1]), versions.size())
  }

  private UpdateKeyWithExpectedVersion(key: string, value: DynamoCoercibleAttributes, version: number) {
    if (version === 0) {
      // this item doesn't exist already, so just call SetAsync
      this.SetAsync(key, value);
      return true;
    }

    const [success, result] = pcall(() => {
      return this.client.UpdateItem({
        TableName: this.table_name,
        Key: {
          key: {
            S: key
          }
        },
        ExpressionAttributeValues: {
          ":V": {
            L: [
              toDynamoAttribute(value)
            ]
          },
          ":VersionId": {
            N: tostring(version)
          },
          ":E": {
            L: []
          }
        },
        ConditionExpression: "size(value) = :VersionId",
        UpdateExpression: "SET value = list_append(if_not_exists(value, :E), :V)"
      });
    });
    print(result)

    return success;
  }

  // eslint-disable-next-line
	GetAsync(key: string): DynamoCoercibleAttributes | undefined {
		const [success, result] = pcall(() => {
			return this.client.GetItem({
				TableName: this.table_name,
				Key: {
					key: {
						S: key,
					},
				},
			});
		});

		if (!success) {
			return undefined;
		}

		const { Item } = result;
		assert(Item["value"]);
		assert(Item["value"]["L"]);
		const versions = Item["value"].L!;
		return $tuple(fromDynamoAttribute(versions[versions.size() - 1]), {});
	}

  RemoveAsync(key: string) {
    const value = this.GetAsync(key);
    this.SetAsync(key, undefined)
    return $tuple(value, {})
  }

  SetAsync<V extends DynamoCoercibleAttributes | undefined>(key: string, value: V) {
    this.client.UpdateItem({
      TableName: this.table_name,
      Key: {
        key: {
          S: key
        }
      },
      ExpressionAttributeValues: {
        ":V": {
          L: [
            toDynamoAttribute(value)
          ]
        },
        ":E": {
          L: []
        }
      },
      UpdateExpression: "SET value = list_append(if_not_exists(value, :E), :V)"
    });

    // TODO: return the version id
    return 0;
  }

  UpdateAsync(key: string, update_fn: (value: DynamoCoercibleAttributes | undefined) => DynamoCoercibleAttributes | undefined) {
    let [value, version] = this.GetKeyWithVersion(key);
    let updatedValue = update_fn(value);
    if (updatedValue === undefined) {
      return $tuple(value, {});
    }

    while (!this.UpdateKeyWithExpectedVersion(key, updatedValue, version)) {
      const result = this.GetKeyWithVersion(key)
      value = result[0];
      version = result[1];
      updatedValue = update_fn(value);
      if (updatedValue === undefined) {
        return $tuple(value, {});
      }
    }

    return $tuple(updatedValue, {});
  }

  IncrementAsync(key: string, increment: number) {
    const [value, _] = this.UpdateAsync(key, (value) => {
      if (type(value) === "nil") {
        return increment
      }
      if (type(value) !== "number") {
        error("Key value was not an integer")
      }
      return (value as number) + increment
    })

    return value;
  }
}
