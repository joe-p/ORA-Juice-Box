# !!! WARNING: NOT TESTED !!!

I have not tested this contract and do no plan to deploy this contract. This is merely a proof-of-concept that anyone can use to build ontop of if they wish, but I take no liability. Happy to answer any questions though!

It's also possible I am missing something fundamental and this is a terrible idea...

# The Juice Box Contract

This is a proof-of-concept contract for what I am calling a juice box. A juice box is essentially a mining pool for ORA. https://oranges.meme

# What's the point?

Right now, ORA is awarded to those who have performed most juicing. Those who haven't juiced as much as the winner won't get any ORA despite their efforts. They might eventually win one block with the sum of their efforts over time, but its no gurantee especially if whales are contiously juicing. 

This contract allows anyone to pool their juicing efforts in a decentralized way. Much like a mining pool, this contract will split the ORA block reward to everyone juicing through it proportional to the amount they have juice (of course, only if the contract is the winner). 

## Example

If there are three people juicing different amounts and the reward is 100 ORA (for simplicity sake):

| Name    | Amount Juiced | ORA Earned w/ Juice Box | ORA Earned w/o Juice Box |
| ------- | ------------- | ----------------------- | ------------------------ |
| Alice   | 1A            | 10                      | 0                        |
| Bob     | 2A            | 20                      | 0                        |
| Charlie | 7A            | 70                      | 100                      |

# How does it work?

Instead of a direct call the ORA contract, to juice through a juice box you call this contract with an atomic payment. The payment will then cover the fees for a `mine` call to the ORA contract sent via an inner transaction. The juice box contract will keep track of how much everyone has juiced and how much ORA the juice box has mined. One the contract has received ORA, anyone that has juiced can claim their share of the ORA.
