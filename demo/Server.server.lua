local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Packages = ReplicatedStorage:WaitForChild("Packages")
local rbxts = Packages:WaitForChild("rbxts")
local TS = require(rbxts:WaitForChild("RuntimeLib"))
--- @module out/client
local DynamoDB = TS.import(script, Packages:WaitForChild("DynamoDB"))
local Client = DynamoDB.DynamoDBClient.new({
  access_key_id = "None",
  secret_access_key = "None",
  region_name = "None",
  endpoint_url = "http://localhost:8000"
});

print(Client:GetItem({
  TableName = "usertable",
  Key = {
     ["key"] = {
        ["S"] = "test"
     }
  }
}))