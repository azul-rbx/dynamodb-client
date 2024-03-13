/*
 * Copyright (c) 2024 Paradoxum Games
 * This file is licensed under the Mozilla Public License (MPL-2.0). A copy of it is available in the 'LICENSE.txt' file at the root of the repository.
 * This file incorporates code from the "aws4fetch" repository (https://github.com/mhart/aws4fetch). A copy of said code's repository is available in the 'LICENSE.aws4fetch.txt' file at the root of the repository.
 * This file incorporates code from the "Roblo3" repository (https://github.com/Roblo3/Roblo3), which was released to the public domain under no license.
 */

import { AwsClient, RequestInit } from "./aws_client";

const HttpService = game.GetService("HttpService");

export type ClientConfig = {
	access_key_id: string;
	secret_access_key: string;
	region_name: string;
	endpoint_url: string;
};

export type AttributeValue = {
	B?: string;
	BOOL?: boolean;
	BS?: string[];
	L?: AttributeValue[];
	M?: { [key: string]: AttributeValue };
	N?: string;
	NS?: string[];
	NULL?: boolean;
	S?: string;
	SS?: string[];
};

type ConsumedCapacity = {
  CapacityUnits: number;
  GlobalSecondaryIndexes: {
    [key: string]: {
      CapacityUnits: number;
      ReadCapacityUnits: number;
      WriteCapacityUnits: number;
    };
  };
  LocalSecondaryIndexes: {
    [key: string]: {
      CapacityUnits: number;
      ReadCapacityUnits: number;
      WriteCapacityUnits: number;
    };
  };
  ReadCapacityUnits: number;
  Table: {
    CapacityUnits: number;
    ReadCapacityUnits: number;
    WriteCapacityUnits: number;
  };
  TableName: string;
  WriteCapacityUnits: number;
}

type GetItemArgs = {
	AttributesToGet?: string[];
	ConsistentRead?: boolean;
	ExpressionAttributeNames?: { [key: string]: string };
	Key: {
		[key: string]: AttributeValue;
	};
	ProjectionExpression?: string;
	ReturnConsumedCapacity?: string;
	TableName: string;
};

type GetItemResult = {
  ConsumedCapacity?: ConsumedCapacity,
  Item: { [key: string]: AttributeValue },
}

type PutItemArgs = {
	ConditionalOperator?: string;
	ConditionExpression?: string;
	Expected?: {
		[key: string]: {
			AttributeValueList?: AttributeValue[];
			ComparisonOperator?: string;
			Exists?: boolean;
			Value?: AttributeValue;
		};
	};
	ExpressionAttributeNames?: { [key: string]: string };
	ExpressionAttributeValues?: { [key: string]: AttributeValue };
	Item: { [key: string]: AttributeValue };
	ReturnConsumedCapacity?: string;
	ReturnItemCollectionMetrics?: string;
	ReturnValues?: string;
	ReturnValuesOnConditionCheckFailure?: string;
	TableName: string;
};

type PutItemResult = {
	Attributes?: { [key: string]: AttributeValue };
	ConsumedCapacity?: ConsumedCapacity
	ItemCollectionMetrics: {
		ItemCollectionKey: {
			[key: string]: AttributeValue;
		},
    SizeEstimateRangeGB: number[]
	};
};

type UpdateItemArgs = {
  AttributeUpdates?: { [key: string]: {
    Action: string,
    Value: AttributeValue
  }};
  ConditionalOperator?: string;
  ConditionExpression?: string;
  Expected?: { [key: string]: {
    AttributeValueList?: AttributeValue[];
    ComparisonOperator?: string;
    Exists?: boolean;
    Value?: AttributeValue;
  }};
  ExpressionAttributeNames?: { [key: string]: string };
  ExpressionAttributeValues?: { [key: string]: AttributeValue };
  Key: { [key: string]: AttributeValue };
  ReturnConsumedCapacity?: string;
	ReturnItemCollectionMetrics?: string;
	ReturnValues?: string;
	ReturnValuesOnConditionCheckFailure?: string;
	TableName: string;
  UpdateExpression?: string;
}

type UpdateItemResult = {
	Attributes?: { [key: string]: AttributeValue };
	ConsumedCapacity?: ConsumedCapacity
	ItemCollectionMetrics: {
		ItemCollectionKey: {
			[key: string]: AttributeValue;
		},
    SizeEstimateRangeGB: number[]
	};
};

type DescribeTableArgs = {
  TableName: string
};

type DescribeTableResult = {
  Table: {

  }
};

type GlobalSecondaryIndex = {
  IndexName: string;
  KeySchema: KeySchemaDefinition[];
  Projection: {
    NonKeyAttributes?: string[],
    ProjectionType: string,
  },
  ProvisionedThroughput?: {
    ReadCapacityUnits: number,
    WriteCapacityUnits: number,
  }
}

type AttributeDefinition = {
  AttributeName: string,
  AttributeType: string
}

type KeySchemaDefinition = {
  AttributeName: string,
  KeyType: "HASH" | "RANGE",
}

export type CreateTableArgs = {
  AttributeDefinitions: AttributeDefinition[],
  BillingMode: string,
  DeletionProtectionEnabled?: boolean,
  GlobalSecondaryIndexes?: GlobalSecondaryIndex[],
  KeySchema: KeySchemaDefinition[],
  LocalSecondaryIndexes?: {
    IndexName: string,
    KeySchema: KeySchemaDefinition[],
    Projection: {
      NonKeyAttributes: string[],
      ProjectionType: string,
    }
  },
  ProvisionedThroughput?: {
    ReadCapacityUnits: number,
    WriteCapacityUnits: number
  },
  SSESpecification?: {
    Enabled: boolean,
    KMSMasterKeyId: string,
    SSEType: string,
  },
  TableClass?: string,
  TableName: string,
  Tags?: { Key: string, Value: string }[]
};

type TableDescription = {
  ArchivalSummary: {
    ArchivalBackupArn: string,
    ArchivalDateTime: number,
    ArchivalReason: string,
  },
  AttributeDefinitions: AttributeDefinition[],
  BillingModeSummary: {
    BillingMode: string,
    LastUpdateToPayPerRequestDateTime: number,
  },
  GlobalSecondaryIndexes: GlobalSecondaryIndex[],
  GlobalTableVersion: string,
  ItemCount: number,
  KeySchema: KeySchemaDefinition[],
  LatestStreamArn: string,
  LatestStreamLabel: string,
  LocalSecondaryIndexes: object[],
  TableArn: string,
  TableId: string,
  TableName: string,
  TableSizeBytes: number,
  TableStatus: string,
}

type CreateTableResult = {
  TableDescription: TableDescription
};

type DeleteItemArgs = {
  Key: { [key: string]: AttributeValue }
  TableName: string
};

type DeleteItemResult = {

};

type ScanArgs = {
  AttributesToGet?: string[],
  ConditionalOperator?: string,
  ConsistentRead?: boolean,
  ExclusiveStartKey?: { [key: string]: AttributeValue },
  ExpressionAttributeNames?: { [key: string]: string },
  ExpressionAttributeValues?: { [key: string]: AttributeValue },
  FilterExpression?: string,
  IndexName?: string,
  Limit?: number,
  ProjectionExpression?: string,
  ReturnConsumedCapacity?: string,
  ScanFilter?: { [key: string]: {
    AttributeValueList: { [key: string]: AttributeValue }[],
    ComparisonOperator: string,
  }}
  Segment?: number,
  Select?: string,
  TableName: string,
  TotalSegments?: number
};

type ScanResult = {
  Count: number,
  Items: {[key: string]: AttributeValue}[],
  LastEvaluatedKey: {[key: string]: AttributeValue},
  ScannedCount: number
};

type QueryArgs = {
  AttributesToGet?: string[],
  ConditionalOperator?: string,
  ConsistentRead?: boolean,
  ExclusiveStartKey?: { [key: string]: AttributeValue },
  ExpressionAttributeNames?: { [key: string]: string },
  ExpressionAttributeValues?: { [key: string]: AttributeValue },
  FilterExpression?: string,
  IndexName?: string,
  KeyConditionExpression?: string,
  KeyConditions?: { [key: string]: {
    AttributeValueList: { [key: string]: AttributeValue }[],
    ComparisonOperator: string,
  }},
  Limit?: number,
  ProjectionExpression?: string,
  ReturnConsumedCapacity?: string,
  QueryFilter?: { [key: string]: {
    AttributeValueList: { [key: string]: AttributeValue }[],
    ComparisonOperator: string,
  }},
  ScanIndexForward?: boolean,
  Select?: string,
  TableName: string,
};

type QueryResult = {
  Count: number,
  Items: {[key: string]: AttributeValue}[],
  LastEvaluatedKey: {[key: string]: AttributeValue},
  ScannedCount: number
};

function between(num: number, min: number, max: number) {
	return num >= min && num <= max;
}

// TODO: make all of these types Better (TM)

export class DynamoDBClient {
	client: AwsClient;

	constructor(readonly config: ClientConfig) {
		this.client = new AwsClient({
			accessKeyId: config.access_key_id,
			secretAccessKey: config.secret_access_key,
			region: config.region_name,
			service: "dynamodb",
		});
	}

	request(args: RequestInit) {
		const result = this.client.fetch(args);
		if (between(result.StatusCode, 200, 299)) {
			return HttpService.JSONDecode(result.Body);
		} else {
			error(`DynamoDB request failed with status code ${result.StatusCode} and body ${result.Body}`);
		}
	}

  CreateTable(args: CreateTableArgs): CreateTableResult {
    const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.CreateTable",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as CreateTableResult;
  }

  DescribeTable(args: DescribeTableArgs): DescribeTableResult {
    const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.DescribeTable",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as DescribeTableResult;

  }

	GetItem(args: GetItemArgs): GetItemResult {
		const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.GetItem",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as GetItemResult;
	}

	PutItem(args: PutItemArgs): PutItemResult {
		const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.PutItem",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as PutItemResult;
	}

  UpdateItem(args: UpdateItemArgs): UpdateItemResult {
		const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.UpdateItem",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as PutItemResult;
	}

  DeleteItem(args: DeleteItemArgs): DeleteItemResult {
    const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.DeleteItem",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as DeleteItemResult;
  }

  Scan(args: ScanArgs): ScanResult {
    const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.Scan",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as ScanResult;
  }

  Query(args: QueryArgs): QueryResult {
    const request = {
			method: "POST",
			host: this.config.endpoint_url,
			path: "/",
			headers: {
				"x-amz-target": "DynamoDB_20120810.Query",
				"Content-Type": "application/x-amz-json-1.0",
			},
			body: HttpService.JSONEncode(args),
		};

		return this.request(request) as QueryResult;
  }
}
