local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Packages = ReplicatedStorage:WaitForChild("Packages")
local rbxts = Packages:WaitForChild("rbxts")
local TS = require(rbxts:WaitForChild("RuntimeLib"))
--- @module out/init
local DynamoDB = TS.import(script, Packages:WaitForChild("DynamoDB"))

local DataStoreService = DynamoDB.DataStore
print(DataStoreService)

local a = (function()
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
end)
a()

local b = function()
  local OrderedDataStore = DynamoDB.OrderedDataStore
  local ds = OrderedDataStore.new("testing2")
  ds:SetAsync("adam", 1000)
  ds:SetAsync("greg", 2000)
  ds:SetAsync("bob", 3000)

  print(ds:GetAsync("adam"))
  local page = ds:GetSortedAsync(false, 100)
  for rank, data in ipairs(page:GetCurrentPage()) do
		local name = data.key
		local points = data.value
		print(name .. " is ranked #" .. rank .. " with " .. points .. " points")
	end
end

b()


