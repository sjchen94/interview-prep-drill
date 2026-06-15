/**
 * DB seed script — populates cards.db with real interview questions.
 * Safe to re-run: upsertCard uses INSERT OR IGNORE, ensureCardState is idempotent.
 *
 * Usage: npm run seed
 */

import { closeDb, ensureCardState, openDb, upsertCard } from '../lib/db.js';

interface SeedCard {
  id: string;
  deck: 'blind75' | 'sysdesign';
  source_path: string;
  title: string;
  body_md: string;
}

const blind75Cards: SeedCard[] = [
  {
    id: 'blind75-001',
    deck: 'blind75',
    source_path: 'blind75/arrays/two-sum.md',
    title: 'Two Sum',
    body_md: `## Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

### Example
\`\`\`
Input:  nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: nums[0] + nums[1] = 2 + 7 = 9
\`\`\`

### Constraints
- 2 ≤ nums.length ≤ 10⁴
- -10⁹ ≤ nums[i] ≤ 10⁹
- Only one valid answer exists

### Hints
- A brute-force O(n²) approach checks every pair.
- Can you achieve O(n) using a hash map to store complements?`,
  },
  {
    id: 'blind75-002',
    deck: 'blind75',
    source_path: 'blind75/arrays/best-time-to-buy-sell-stock.md',
    title: 'Best Time to Buy and Sell Stock',
    body_md: `## Best Time to Buy and Sell Stock

You are given an array \`prices\` where \`prices[i]\` is the price of a given stock on the \`i\`th day.

Return the **maximum profit** you can achieve from this transaction. If you cannot achieve any profit, return \`0\`.

### Example
\`\`\`
Input:  prices = [7,1,5,3,6,4]
Output: 5
Explanation: Buy on day 2 (price=1), sell on day 5 (price=6). Profit = 6-1 = 5.
\`\`\`

### Constraints
- 1 ≤ prices.length ≤ 10⁵
- 0 ≤ prices[i] ≤ 10⁴

### Hints
- Track the minimum price seen so far.
- At each step, compute profit if you sold today. Update max profit.`,
  },
  {
    id: 'blind75-003',
    deck: 'blind75',
    source_path: 'blind75/arrays/contains-duplicate.md',
    title: 'Contains Duplicate',
    body_md: `## Contains Duplicate

Given an integer array \`nums\`, return \`true\` if any value appears **at least twice**, and \`false\` if every element is distinct.

### Example
\`\`\`
Input:  nums = [1,2,3,1]
Output: true

Input:  nums = [1,2,3,4]
Output: false
\`\`\`

### Constraints
- 1 ≤ nums.length ≤ 10⁵
- -10⁹ ≤ nums[i] ≤ 10⁹

### Hints
- Use a HashSet. If inserting an element that already exists, return true.`,
  },
  {
    id: 'blind75-004',
    deck: 'blind75',
    source_path: 'blind75/arrays/product-of-array-except-self.md',
    title: 'Product of Array Except Self',
    body_md: `## Product of Array Except Self

Given an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` is equal to the product of all elements of \`nums\` **except** \`nums[i]\`.

You must write an algorithm that runs in O(n) time **without using the division operation**.

### Example
\`\`\`
Input:  nums = [1,2,3,4]
Output: [24,12,8,6]
\`\`\`

### Constraints
- 2 ≤ nums.length ≤ 10⁵
- -30 ≤ nums[i] ≤ 30
- Guaranteed that product of any prefix/suffix fits in 32-bit integer

### Hints
- Two passes: compute prefix products left-to-right, then multiply in suffix products right-to-left.
- Do it in O(1) extra space (output array doesn't count).`,
  },
  {
    id: 'blind75-005',
    deck: 'blind75',
    source_path: 'blind75/arrays/maximum-subarray.md',
    title: 'Maximum Subarray (Kadane\'s Algorithm)',
    body_md: `## Maximum Subarray

Given an integer array \`nums\`, find the **subarray** with the largest sum, and return its sum.

### Example
\`\`\`
Input:  nums = [-2,1,-3,4,-1,2,1,-5,4]
Output: 6
Explanation: subarray [4,-1,2,1] has the largest sum = 6
\`\`\`

### Constraints
- 1 ≤ nums.length ≤ 10⁵
- -10⁴ ≤ nums[i] ≤ 10⁴

### Hints
- Kadane's algorithm: maintain a running sum, reset to 0 when it goes negative.
- Track the global maximum at each step.`,
  },
  {
    id: 'blind75-006',
    deck: 'blind75',
    source_path: 'blind75/arrays/merge-intervals.md',
    title: 'Merge Intervals',
    body_md: `## Merge Intervals

Given an array of \`intervals\` where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

### Example
\`\`\`
Input:  intervals = [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]
Explanation: Intervals [1,3] and [2,6] overlap → merged to [1,6]
\`\`\`

### Constraints
- 1 ≤ intervals.length ≤ 10⁴
- intervals[i].length == 2
- 0 ≤ start_i ≤ end_i ≤ 10⁴

### Hints
- Sort by start time.
- Iterate: if current start ≤ last merged end, extend the end; otherwise push new interval.`,
  },
  {
    id: 'blind75-007',
    deck: 'blind75',
    source_path: 'blind75/strings/valid-parentheses.md',
    title: 'Valid Parentheses',
    body_md: `## Valid Parentheses

Given a string \`s\` containing just the characters '(', ')', '{', '}', '[', ']', determine if the input string is **valid**.

A string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Example
\`\`\`
Input:  s = "()[]{}"
Output: true

Input:  s = "(]"
Output: false
\`\`\`

### Hints
- Use a stack. Push open brackets; on close bracket, check if top of stack matches.
- At the end, stack should be empty.`,
  },
  {
    id: 'blind75-008',
    deck: 'blind75',
    source_path: 'blind75/strings/longest-substring-without-repeating.md',
    title: 'Longest Substring Without Repeating Characters',
    body_md: `## Longest Substring Without Repeating Characters

Given a string \`s\`, find the length of the **longest substring** without repeating characters.

### Example
\`\`\`
Input:  s = "abcabcbb"
Output: 3
Explanation: "abc" is the longest substring without repeating characters.
\`\`\`

### Constraints
- 0 ≤ s.length ≤ 5 × 10⁴
- s consists of English letters, digits, symbols and spaces

### Hints
- Sliding window with a set.
- Expand right pointer; when duplicate found, shrink from left until no duplicate.`,
  },
  {
    id: 'blind75-009',
    deck: 'blind75',
    source_path: 'blind75/strings/valid-anagram.md',
    title: 'Valid Anagram',
    body_md: `## Valid Anagram

Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.

### Example
\`\`\`
Input:  s = "anagram", t = "nagaram"
Output: true

Input:  s = "rat", t = "car"
Output: false
\`\`\`

### Constraints
- 1 ≤ s.length, t.length ≤ 5 × 10⁴
- s and t consist of lowercase English letters

### Hints
- Count character frequencies in both strings, compare.
- Or sort both strings and compare — O(n log n).`,
  },
  {
    id: 'blind75-010',
    deck: 'blind75',
    source_path: 'blind75/binary-search/binary-search.md',
    title: 'Binary Search',
    body_md: `## Binary Search

Given an array of integers \`nums\` sorted in ascending order, and an integer \`target\`, write a function to search for \`target\` in \`nums\`. Return its index if found, or \`-1\` if not.

You must write an algorithm with **O(log n)** runtime complexity.

### Example
\`\`\`
Input:  nums = [-1,0,3,5,9,12], target = 9
Output: 4

Input:  nums = [-1,0,3,5,9,12], target = 2
Output: -1
\`\`\`

### Constraints
- 1 ≤ nums.length ≤ 10⁴
- All integers in nums are unique
- nums is sorted in ascending order

### Hints
- Maintain lo and hi pointers; compute mid = lo + (hi - lo) // 2 to avoid overflow.
- Narrow the range based on whether nums[mid] is less than or greater than target.`,
  },
  {
    id: 'blind75-011',
    deck: 'blind75',
    source_path: 'blind75/binary-search/search-rotated-sorted-array.md',
    title: 'Search in Rotated Sorted Array',
    body_md: `## Search in Rotated Sorted Array

There is an integer array \`nums\` sorted in ascending order (with distinct values). Prior to being passed to your function, \`nums\` may have been **rotated** at an unknown pivot index.

Given the array \`nums\` and an integer \`target\`, return the index of \`target\` if it is in \`nums\`, or \`-1\` if it is not.

You must write an algorithm with **O(log n)** runtime complexity.

### Example
\`\`\`
Input:  nums = [4,5,6,7,0,1,2], target = 0
Output: 4

Input:  nums = [4,5,6,7,0,1,2], target = 3
Output: -1
\`\`\`

### Hints
- Modified binary search: determine which half is sorted, then decide which half target falls in.`,
  },
  {
    id: 'blind75-012',
    deck: 'blind75',
    source_path: 'blind75/trees/maximum-depth-binary-tree.md',
    title: 'Maximum Depth of Binary Tree',
    body_md: `## Maximum Depth of Binary Tree

Given the \`root\` of a binary tree, return its **maximum depth** — the number of nodes along the longest path from the root to the farthest leaf.

### Example
\`\`\`
    3
   / \\
  9  20
    /  \\
   15   7

Input:  root = [3,9,20,null,null,15,7]
Output: 3
\`\`\`

### Hints
- DFS (recursive): depth = 1 + max(depth(left), depth(right))
- BFS (iterative): level-order traversal, count levels.`,
  },
  {
    id: 'blind75-013',
    deck: 'blind75',
    source_path: 'blind75/trees/invert-binary-tree.md',
    title: 'Invert Binary Tree',
    body_md: `## Invert Binary Tree

Given the \`root\` of a binary tree, invert the tree (mirror it), and return its root.

### Example
\`\`\`
Before:       After:
    4             4
   / \\           / \\
  2   7   →    7   2
 / \\ / \\      / \\ / \\
1  3 6  9    9  6 3  1
\`\`\`

### Hints
- Recursive: swap left and right children, then recurse into each subtree.
- Iterative: use a queue (BFS) or stack (DFS), swapping at each node.`,
  },
  {
    id: 'blind75-014',
    deck: 'blind75',
    source_path: 'blind75/trees/validate-binary-search-tree.md',
    title: 'Validate Binary Search Tree',
    body_md: `## Validate Binary Search Tree

Given the \`root\` of a binary tree, determine if it is a valid binary search tree (BST).

A valid BST is defined as:
- The left subtree of a node contains only nodes with keys **less than** the node's key.
- The right subtree of a node contains only nodes with keys **greater than** the node's key.
- Both left and right subtrees are also BSTs.

### Example
\`\`\`
    5
   / \\
  1   4
     / \\
    3   6

Output: false (4 is not > 5)
\`\`\`

### Hints
- Pass valid (min, max) bounds down the tree at each recursive call.
- In-order traversal should produce a strictly increasing sequence.`,
  },
  {
    id: 'blind75-015',
    deck: 'blind75',
    source_path: 'blind75/graphs/number-of-islands.md',
    title: 'Number of Islands (BFS/DFS)',
    body_md: `## Number of Islands

Given an \`m x n\` 2D binary grid where \`'1'\` represents land and \`'0'\` represents water, return the **number of islands**.

An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.

### Example
\`\`\`
Input:
  11110
  11010
  11000
  00000
Output: 1

Input:
  11000
  11000
  00100
  00011
Output: 3
\`\`\`

### Hints
- Iterate each cell. When you find a '1', increment count and BFS/DFS to mark all connected land as visited (set to '0' or use a visited set).`,
  },
  {
    id: 'blind75-016',
    deck: 'blind75',
    source_path: 'blind75/graphs/clone-graph.md',
    title: 'Clone Graph',
    body_md: `## Clone Graph

Given a reference of a node in a **connected undirected graph**, return a **deep copy** (clone) of the graph.

Each node contains a value (\`int\`) and a list of neighbors (\`Node[]|List[Node]\`).

### Hints
- Use a hash map: original node → cloned node.
- BFS or DFS from the given node; for each neighbor, if not yet cloned, clone it and add to queue.
- Prevents infinite loops in cyclic graphs.`,
  },
  {
    id: 'blind75-017',
    deck: 'blind75',
    source_path: 'blind75/dp/climbing-stairs.md',
    title: 'Climbing Stairs',
    body_md: `## Climbing Stairs

You are climbing a staircase. It takes \`n\` steps to reach the top. Each time you can climb **1 or 2** steps. In how many distinct ways can you climb to the top?

### Example
\`\`\`
Input:  n = 3
Output: 3
Explanation: 1+1+1, 1+2, 2+1
\`\`\`

### Constraints
- 1 ≤ n ≤ 45

### Hints
- This is Fibonacci: ways(n) = ways(n-1) + ways(n-2).
- Base cases: ways(1) = 1, ways(2) = 2.
- O(n) time, O(1) space with two variables.`,
  },
  {
    id: 'blind75-018',
    deck: 'blind75',
    source_path: 'blind75/dp/coin-change.md',
    title: 'Coin Change',
    body_md: `## Coin Change

You are given an integer array \`coins\` representing coins of different denominations and an integer \`amount\` representing a total amount of money.

Return the **fewest number of coins** needed to make up that amount. If no combination works, return \`-1\`.

### Example
\`\`\`
Input:  coins = [1,5,10,25], amount = 41
Output: 4
Explanation: 25 + 10 + 5 + 1

Input:  coins = [2], amount = 3
Output: -1
\`\`\`

### Hints
- Classic unbounded knapsack / bottom-up DP.
- \`dp[i]\` = minimum coins for amount \`i\`. Initialize dp[0]=0, rest=Infinity.
- For each amount i, try each coin c: dp[i] = min(dp[i], dp[i-c] + 1).`,
  },
  {
    id: 'blind75-019',
    deck: 'blind75',
    source_path: 'blind75/dp/longest-common-subsequence.md',
    title: 'Longest Common Subsequence',
    body_md: `## Longest Common Subsequence

Given two strings \`text1\` and \`text2\`, return the length of their **longest common subsequence**. If there is no common subsequence, return \`0\`.

A subsequence is a sequence that can be derived from another sequence by deleting some elements without changing the order of the remaining elements.

### Example
\`\`\`
Input:  text1 = "abcde", text2 = "ace"
Output: 3
Explanation: LCS is "ace"
\`\`\`

### Hints
- 2D DP: dp[i][j] = LCS of text1[0..i-1] and text2[0..j-1].
- If text1[i-1] == text2[j-1]: dp[i][j] = dp[i-1][j-1] + 1.
- Else: dp[i][j] = max(dp[i-1][j], dp[i][j-1]).`,
  },
  {
    id: 'blind75-020',
    deck: 'blind75',
    source_path: 'blind75/linked-list/reverse-linked-list.md',
    title: 'Reverse Linked List',
    body_md: `## Reverse Linked List

Given the \`head\` of a singly linked list, reverse the list, and return the reversed list's head.

### Example
\`\`\`
Input:  1 → 2 → 3 → 4 → 5 → null
Output: 5 → 4 → 3 → 2 → 1 → null
\`\`\`

### Constraints
- 0 ≤ number of nodes ≤ 5000
- -5000 ≤ Node.val ≤ 5000

### Hints
- Iterative: maintain prev=null, curr=head. At each step: next=curr.next; curr.next=prev; prev=curr; curr=next.
- Recursive: reverse(head.next), then head.next.next = head; head.next = null.`,
  },
  {
    id: 'blind75-021',
    deck: 'blind75',
    source_path: 'blind75/linked-list/detect-cycle.md',
    title: 'Linked List Cycle Detection',
    body_md: `## Linked List Cycle Detection

Given the \`head\` of a linked list, determine if the linked list has a **cycle** in it.

Return \`true\` if there is a cycle, \`false\` otherwise.

**Follow-up:** Can you find the node where the cycle begins?

### Hints
- Floyd's tortoise-and-hare: slow moves 1 step, fast moves 2 steps. If they ever meet, there's a cycle.
- To find cycle start: reset one pointer to head; advance both one step at a time — they meet at the cycle start.`,
  },
  {
    id: 'blind75-022',
    deck: 'blind75',
    source_path: 'blind75/graphs/course-schedule.md',
    title: 'Course Schedule (Cycle Detection in Directed Graph)',
    body_md: `## Course Schedule

There are \`numCourses\` courses (0 to numCourses-1). You are given an array \`prerequisites\` where \`prerequisites[i] = [a, b]\` means you must take course \`b\` before course \`a\`.

Return \`true\` if you can finish all courses, \`false\` otherwise.

### Example
\`\`\`
Input:  numCourses = 2, prerequisites = [[1,0],[0,1]]
Output: false
Explanation: Courses 0 and 1 are mutually dependent — impossible.
\`\`\`

### Hints
- Build adjacency list. Run DFS cycle detection (three states: unvisited, in-progress, done).
- Alternatively: Kahn's algorithm (topological sort with BFS). If sorted count < numCourses, cycle exists.`,
  },
  {
    id: 'blind75-023',
    deck: 'blind75',
    source_path: 'blind75/trees/lowest-common-ancestor-bst.md',
    title: 'Lowest Common Ancestor of a BST',
    body_md: `## Lowest Common Ancestor of a BST

Given a BST, and two nodes \`p\` and \`q\`, find their **lowest common ancestor** (LCA) — the lowest node that has both p and q as descendants (a node can be a descendant of itself).

### Example
\`\`\`
        6
       / \\
      2   8
     / \\ / \\
    0  4 7  9
      / \\
     3   5

LCA(2, 8) = 6
LCA(2, 4) = 2
\`\`\`

### Hints
- In a BST: if both p.val and q.val < node.val, go left. If both > node.val, go right. Otherwise, current node is LCA.
- Can be done iteratively in O(h) time, O(1) space.`,
  },
];

const sysdesignCards: SeedCard[] = [
  {
    id: 'sysdesign-001',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-twitter.md',
    title: 'Design Twitter (Social Feed)',
    body_md: `## Design Twitter

Design a simplified version of Twitter, supporting:
- Posting tweets
- Following/unfollowing users
- Viewing a home timeline (most recent tweets from followed users)

### Functional Requirements
- Users can post tweets (text, ≤280 chars)
- Users can follow/unfollow other users
- Fetch home timeline (N most recent tweets from followees)
- Like and retweet (optional)

### Non-Functional Requirements
- 300M MAU, 500M tweets/day (write-heavy but read >> write)
- Timeline load: p99 < 500ms
- Availability > 99.99%

### Key Discussion Points
1. **Data model:** Users, Tweets, Follows tables. Fan-out on write vs. read.
2. **Timeline generation:** Push model (write to followers' feed cache on tweet) vs. pull model (merge sorted tweet lists at read time). Hybrid for celebrities.
3. **Caching:** Redis sorted sets for home timelines (score = timestamp). Cache top-K followers' feeds.
4. **Sharding:** Shard tweets by tweet_id or user_id. Consistent hashing.
5. **CDN:** Media (images/videos) served via CDN. Presigned URLs for upload.
6. **Search:** Elasticsearch for tweet full-text search.`,
  },
  {
    id: 'sysdesign-002',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-url-shortener.md',
    title: 'Design a URL Shortener (TinyURL)',
    body_md: `## Design a URL Shortener

Design a service like bit.ly or TinyURL that:
- Takes a long URL and returns a short alias
- Redirects from the short URL to the original

### Functional Requirements
- Shorten a URL → 6–8 char alias (unique)
- Redirect short URL → original URL (301 permanent or 302 temporary)
- Optional: custom alias, expiration, analytics

### Non-Functional Requirements
- 100M URLs shortened/day (write)
- 10B redirects/day (read, ~100:1 read:write ratio)
- Low latency: redirect p99 < 50ms
- Highly available, eventually consistent

### Key Discussion Points
1. **ID generation:** Base62 encoding of auto-increment ID, or MD5 hash (truncate to 7 chars + collision handling), or Snowflake ID.
2. **Storage:** Simple KV store — short_code → {long_url, created_at, expires_at, user_id}. Cassandra or DynamoDB for scale.
3. **Redirect:** Cache hot short codes in Redis (LRU). 301 vs 302: 302 enables analytics tracking.
4. **Custom aliases:** Store separately, check availability before insert.
5. **Expiration:** TTL in DB + Redis; background job to clean expired entries.
6. **Rate limiting:** Per-IP or per-user token bucket.`,
  },
  {
    id: 'sysdesign-003',
    deck: 'sysdesign',
    source_path: 'sysdesign/rate-limiter.md',
    title: 'Design a Rate Limiter',
    body_md: `## Design a Rate Limiter

Design a rate limiting system that restricts the number of requests a client can make in a given time window.

### Requirements
- Enforce limits like: 100 req/user/min, 1000 req/IP/hour
- Should work in a distributed environment
- Minimal latency overhead (< 5ms per check)
- Graceful response: 429 Too Many Requests with Retry-After header

### Key Discussion Points

#### Algorithms
| Algorithm | Pros | Cons |
|---|---|---|
| Fixed Window Counter | Simple | Burst at window boundary |
| Sliding Window Log | Accurate | High memory (stores timestamps) |
| Sliding Window Counter | Good accuracy, low memory | Approximate |
| Token Bucket | Handles bursts | Complex implementation |
| Leaky Bucket | Smooth output | May drop valid requests |

#### Distributed Rate Limiting
- **Redis** with atomic Lua scripts or \`INCR\`+\`EXPIRE\`.
- **Sliding window with Redis sorted sets:** ZADD with timestamp score, ZREMRANGEBYSCORE for old entries, ZCARD for count.
- **Sticky sessions:** Route same user to same node (loses HA).
- **Gossip protocol / eventual consistency:** Accept slight over-limit for availability.

#### Placement
- API Gateway (e.g. Kong, AWS API GW) — easiest.
- Middleware layer (sidecar per service).
- Client-side (unreliable, for UX only).`,
  },
  {
    id: 'sysdesign-004',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-cdn.md',
    title: 'Design a Content Delivery Network (CDN)',
    body_md: `## Design a Content Delivery Network (CDN)

Design a CDN that caches and serves static assets (images, JS, CSS, videos) from geographically distributed edge servers.

### Requirements
- Serve static content with low latency globally
- Cache content at edge locations close to users
- Cache invalidation and purge support
- Support for large files (streaming)

### Key Discussion Points
1. **Architecture:** Origin server → Regional PoPs → Edge nodes. User's DNS resolves to nearest PoP (Anycast or GeoDNS).
2. **Caching strategy:**
   - Cache-Control and Expires headers drive TTL.
   - Cache key: URL + Vary headers (Accept-Encoding, etc.).
   - Cache hit ratio target: > 90%.
3. **Pull vs. Push:**
   - Pull CDN: cache on first miss, populate from origin.
   - Push CDN: pre-populate edge (good for known large files).
4. **Cache invalidation:** Purge by URL, tag-based purge, versioned URLs (\`/v1.2.3/app.js\`).
5. **Large file delivery:** Chunked transfer, range requests, multi-CDN failover.
6. **Security:** Signed URLs for private content, DDoS protection at edge, TLS termination.`,
  },
  {
    id: 'sysdesign-005',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-key-value-store.md',
    title: 'Design a Distributed Key-Value Store',
    body_md: `## Design a Distributed Key-Value Store

Design a distributed KV store like Redis Cluster, DynamoDB, or Cassandra.

### Requirements
- GET(key), PUT(key, value), DELETE(key)
- Horizontal scalability (add/remove nodes)
- Tunable consistency (strong vs. eventual)
- High availability (no single point of failure)

### Key Discussion Points
1. **Consistent hashing:** Map keys to nodes using a hash ring. Virtual nodes handle uneven distribution. Nodes own token ranges.
2. **Replication:** Replicate each key to N nodes (e.g., N=3). Write to W replicas, read from R replicas. Strong consistency: W+R > N.
3. **Conflict resolution:** Last-write-wins (LWW) with timestamps, or vector clocks, or CRDTs for true eventual consistency.
4. **Gossip protocol:** Nodes periodically exchange membership/health info.
5. **Anti-entropy:** Merkle trees to detect and sync diverged replicas.
6. **Storage engine:** LSM-tree (write-optimized, Cassandra/LevelDB) vs. B-tree (read-optimized, traditional DBs).
7. **CAP theorem:** In a partition, choose CP (linearizable) or AP (available + eventually consistent).`,
  },
  {
    id: 'sysdesign-006',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-web-crawler.md',
    title: 'Design a Web Crawler',
    body_md: `## Design a Web Crawler

Design a scalable web crawler that can crawl billions of web pages.

### Requirements
- Start from seed URLs, discover and fetch new pages
- Extract links, deduplicate, and schedule them
- Respect robots.txt and crawl-delay
- Store crawled content for indexing

### Scale
- Crawl 1B pages over 30 days ≈ 400 pages/sec
- Avg page size 100KB → 100TB storage

### Key Discussion Points
1. **URL frontier:** Priority queue of URLs to crawl. Separate queues per domain to respect rate limits.
2. **DNS resolution cache:** Avoid re-resolving frequently crawled domains.
3. **Deduplication:** Bloom filter for URL seen-set (space-efficient, allows false positives). Simhash for near-duplicate content.
4. **Politeness:** robots.txt cache, per-domain crawl delay, politeness queue (one slot per domain).
5. **Distributed workers:** Stateless crawler workers pull from URL frontier. Kafka or SQS as the queue.
6. **Storage:** Raw HTML in object store (S3). Parsed content/links in a graph DB or relational DB.
7. **Trap avoidance:** Detect spider traps (infinitely generating URLs), URL normalization, max depth.`,
  },
  {
    id: 'sysdesign-007',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-notification-system.md',
    title: 'Design a Notification System',
    body_md: `## Design a Notification System

Design a system that sends notifications to users across multiple channels: push (iOS/Android), email, and SMS.

### Requirements
- Send targeted notifications to users
- Support push, email, SMS channels
- At-least-once delivery (no dropped notifications)
- Preference management (opt-out per channel)
- Analytics: open rates, delivery rates

### Key Discussion Points
1. **Ingestion:** Event-driven — services publish events to a message queue (Kafka/SQS). Notification service consumes.
2. **Channel routing:** Check user preferences, select appropriate channel(s). Fall back (push fails → SMS).
3. **Third-party integrations:** APNs (Apple), FCM (Google), Twilio (SMS), SendGrid (email). Abstract behind adapters.
4. **Delivery guarantees:** Retry with exponential backoff for failed deliveries. Dead letter queue for persistent failures.
5. **Rate limiting:** Per-user throttling to prevent spam. Batching for bulk campaigns.
6. **Deduplication:** Idempotency keys to prevent duplicate sends on retry.
7. **Scalability:** Each channel worker scales independently. Partition Kafka by user_id.`,
  },
  {
    id: 'sysdesign-008',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-chat-system.md',
    title: 'Design a Real-Time Chat System',
    body_md: `## Design a Real-Time Chat System

Design a real-time chat application like WhatsApp or Slack supporting 1:1 and group chat.

### Requirements
- Send/receive messages in real-time
- Message history and persistence
- Online/offline presence indicators
- Read receipts
- Support groups up to 1000 members

### Key Discussion Points
1. **Transport:** WebSockets for real-time bidirectional communication. Long polling as fallback. HTTP for non-real-time APIs.
2. **Connection management:** Chat servers maintain persistent WebSocket connections. Use a consistent hash to route user → server.
3. **Message flow:** Sender → Chat server → Message queue (Kafka) → Recipient's chat server → WebSocket push. If offline: push notification.
4. **Storage:** Messages stored in a DB sharded by channel_id/user_id. Cassandra works well (write-heavy, time-series-like access). Index by (channel_id, created_at).
5. **Presence:** Heartbeat mechanism — clients send pulse every 30s. Redis with TTL tracks online status. Pub/sub for presence updates.
6. **Group messaging:** Fan-out at the message queue layer. For large groups, use a copy-on-write fan-out service.
7. **E2E Encryption:** Signal protocol for key exchange; server never sees plaintext.`,
  },
  {
    id: 'sysdesign-009',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-search-autocomplete.md',
    title: 'Design a Search Autocomplete System',
    body_md: `## Design a Search Autocomplete System

Design the autocomplete (typeahead) feature for a search engine — as a user types, show top-k suggestions.

### Requirements
- Return top-5 completions in < 100ms
- Suggestions ranked by query frequency/recency
- Update suggestions based on real search traffic
- Support 10M users, 10K queries/sec

### Key Discussion Points
1. **Trie data structure:** Store query strings in a trie. Each node stores top-k queries for that prefix (aggregated).
2. **Offline aggregation:** Batch job (Hadoop/Spark) aggregates query logs → compute top-k per prefix → update trie snapshots.
3. **Storage:** Trie stored in Redis (serialized) for fast in-memory lookup. Snapshots stored in S3.
4. **Serving:** Stateless API servers load trie into memory on startup. Return top-k for given prefix.
5. **Update frequency:** Rebuild trie daily or hourly. Incremental updates via streaming (Flink) for real-time trending.
6. **Filtering:** Block profanity and harmful queries. Personal vs. global rankings.
7. **Multi-language support:** Unicode normalization. Separate tries per locale.`,
  },
  {
    id: 'sysdesign-010',
    deck: 'sysdesign',
    source_path: 'sysdesign/design-ride-sharing.md',
    title: 'Design a Ride-Sharing Service (Uber/Lyft)',
    body_md: `## Design a Ride-Sharing Service

Design the core backend of a ride-sharing app like Uber or Lyft.

### Requirements
- Rider requests a ride with pickup/dropoff
- Match rider with nearby available driver
- Real-time driver location tracking
- Dynamic pricing (surge)
- Trip tracking and history

### Key Discussion Points
1. **Location service:** Drivers send GPS updates every 4 seconds. Store in Redis with geospatial index (GEOADD/GEORADIUS). Shard by geohash region.
2. **Matching service:** On ride request, query nearby drivers within radius. Rank by ETA (not just distance). Consider driver preferences, surge zones.
3. **Trip state machine:** REQUESTED → MATCHED → EN_ROUTE → ARRIVED → IN_TRIP → COMPLETED. Persist in Postgres.
4. **Real-time communication:** WebSocket or MQTT for driver/rider app updates. Push driver location to rider's app.
5. **Surge pricing:** Compute supply/demand ratio per geohash cell. Use a stream processor (Flink) on location events. Propagate pricing via cache.
6. **Map/routing:** Integration with Google Maps or internal routing engine (OSRM). Cache route calculations.
7. **Payments:** Stripe for card processing. Idempotent payment requests. Handle partial charges, refunds.`,
  },
];

async function main() {
  const db = openDb();
  const now = Date.now();

  console.log('Seeding cards.db...\n');

  let insertedCards = 0;
  let skippedCards = 0;

  const allCards = [...blind75Cards, ...sysdesignCards];

  for (const card of allCards) {
    const inserted = upsertCard(db, {
      id: card.id,
      deck: card.deck,
      source_path: card.source_path,
      title: card.title,
      body_md: card.body_md,
      created_at: now,
    });

    if (inserted) {
      insertedCards++;
      console.log(`  [+] ${card.deck.padEnd(10)} ${card.id}  ${card.title}`);
    } else {
      skippedCards++;
      console.log(`  [~] ${card.deck.padEnd(10)} ${card.id}  ${card.title} (already exists)`);
    }

    // Ensure SM-2 state row exists (idempotent — sets due_at = now so card is immediately due)
    ensureCardState(db, card.id, now);
  }

  // Verify with a count query
  const countCards = (db.prepare('SELECT COUNT(*) as n FROM cards').get() as { n: number }).n;
  const countStates = (db.prepare('SELECT COUNT(*) as n FROM card_state').get() as { n: number }).n;
  const countDue = (db.prepare('SELECT COUNT(*) as n FROM card_state WHERE due_at <= ?').get(now) as { n: number }).n;

  console.log('\n--- Seed complete ---');
  console.log(`  Inserted this run : ${insertedCards}`);
  console.log(`  Already existed   : ${skippedCards}`);
  console.log(`  Total cards in DB : ${countCards}`);
  console.log(`  Total card_state  : ${countStates}`);
  console.log(`  Due now           : ${countDue}`);

  closeDb();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
