local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Packages = ReplicatedStorage:WaitForChild("Packages")
local rbxts = Packages:WaitForChild("rbxts")
local TS = require(rbxts:WaitForChild("RuntimeLib"))
--- @module out/init
local DataStoreService = TS.import(script, Packages:WaitForChild("DynamoDB")).DataStore
print(DataStoreService)
local DataStore = DataStoreService.new("users")
DataStore:SetAsync("hello", "world")
print(DataStore:GetAsync("hello"))
DataStore:SetAsync("hello", 1234)
print(DataStore:GetAsync("hello"))
DataStore:RemoveAsync("hello")
print(DataStore:GetAsync("hello"))
DataStore:UpdateAsync("hello", function(value)
  return "world"
end)
print(DataStore:GetAsync("hello"))
DataStore:UpdateAsync("hello", function(_) return nil end)
print(DataStore:GetAsync("hello"))
DataStore:SetAsync("counter", 0)
print(DataStore:GetAsync("counter"))
print(DataStore:IncrementAsync("counter", 1000))
print(DataStore:GetAsync("counter"))
print(DataStore:IncrementAsync("counter2", 1000))