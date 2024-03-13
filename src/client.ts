import HashLib from "@rbxts/rbxts-hashlib";
import { AwsClient } from "./aws_client";

const HttpService = game.GetService("HttpService")

export type ClientConfig = {
  access_key_id: string,
  secret_access_key: string,
  region_name: string,
  endpoint_url: string
};

type GetItemArgs = {
  TableName: string,
  ConsistentRead: boolean,
  ReturnConsumedCapacity: string,
};

function between(num: number, min: number, max: number) {
  return num >= min && num <= max;
}

export class DynamoDBClient {
  client: AwsClient

  constructor(readonly config: ClientConfig) {
    this.client = new AwsClient({
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
      region: config.region_name,
      service: "dynamodb",
    });
  } 

  GetItem(args: GetItemArgs) {
    const request = {
      method: "POST",
      host: this.config.endpoint_url,
      path: "/",
      query: new Map<string, string>(),
      headers: {
        "x-amz-target": "DynamoDB_20120810.GetItem",
        "Content-Type": "application/x-amz-json-1.0"
      },
      body: HttpService.JSONEncode(args)
    }

    const result = this.client.fetch(request);
    if (between(result.StatusCode, 200, 299)) {
      return HttpService.JSONDecode(result.Body)
    } else {
      error(`DynamoDB request failed with status code ${result.StatusCode} and body ${result.Body}`)
    }
  }  
}
