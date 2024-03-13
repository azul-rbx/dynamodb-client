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

function createTableIfNotExist(table: string)
  local success, _ = pcall(function ()
    return Client:DescribeTable({
      TableName = table
    })
  end)

  if success then
    return
  end

  return Client:CreateTable({
    AttributeDefinitions = {
      {
        AttributeName = "key",
        AttributeType = "S"
      }
    },
    BillingMode = 'PAY_PER_REQUEST',
    TableName = table,
    KeySchema = {
      {
        AttributeName = "key",
        KeyType = "HASH"
      }
    }
  })
end

createTableIfNotExist("testing")

Client:PutItem({
  TableName = "testing",
  Item = {
    key = {
      ["S"] = "hello"
    },
    value = {
      ["S"] = "world"
    }
  }
})

print(Client:GetItem({
  TableName = "testing",
  Key = {
     ["key"] = {
        ["S"] = "hello"
     }
  }
}))