/**
 * Replaces the brief ### Hints stub in every blind75 card with a full ### Solution block.
 * Safe to re-run — idempotent (replaces existing ### Solution too).
 * Usage: npm run update-solutions
 */
import { closeDb, openDb } from "../lib/db.js";

type Entry = { id: string; solution: string };

/* ── Solutions ──────────────────────────────────────────────────── */

const SOLUTIONS: Entry[] = [
  {
    id: "blind75-001",
    solution: `### Solution

**Approach:** Single-pass hash map — **Time:** O(n) | **Space:** O(n)

\`\`\`python
def twoSum(nums: list[int], target: int) -> list[int]:
    seen = {}           # value → index
    for i, n in enumerate(nums):
        complement = target - n
        if complement in seen:
            return [seen[complement], i]
        seen[n] = i
\`\`\`

**Key insight:** For each number, its required partner is \`target - num\`. Store each value's index as you scan; check in O(1) if the partner already appeared.`,
  },
  {
    id: "blind75-002",
    solution: `### Solution

**Approach:** One-pass greedy — **Time:** O(n) | **Space:** O(1)

\`\`\`python
def maxProfit(prices: list[int]) -> int:
    min_price = float("inf")
    max_profit = 0
    for price in prices:
        min_price = min(min_price, price)
        max_profit = max(max_profit, price - min_price)
    return max_profit
\`\`\`

**Key insight:** At each day, the best possible profit if you sell today is \`price - min_seen_so_far\`. Track both the running minimum buy price and the running maximum profit simultaneously.`,
  },
  {
    id: "blind75-003",
    solution: `### Solution

**Approach:** Hash set — **Time:** O(n) | **Space:** O(n)

\`\`\`python
def containsDuplicate(nums: list[int]) -> bool:
    seen = set()
    for n in nums:
        if n in seen:
            return True
        seen.add(n)
    return False

# One-liner:
# return len(nums) != len(set(nums))
\`\`\`

**Key insight:** A set stores each value once. If inserting a number that already exists, a duplicate is found. Early-return means O(1) space at best; O(n) worst case.`,
  },
  {
    id: "blind75-004",
    solution: `### Solution

**Approach:** Two-pass prefix/suffix products, no division — **Time:** O(n) | **Space:** O(1) extra

\`\`\`python
def productExceptSelf(nums: list[int]) -> list[int]:
    n = len(nums)
    result = [1] * n

    # Left pass: result[i] = product of everything LEFT of i
    prefix = 1
    for i in range(n):
        result[i] = prefix
        prefix *= nums[i]

    # Right pass: multiply in product of everything RIGHT of i
    suffix = 1
    for i in range(n - 1, -1, -1):
        result[i] *= suffix
        suffix *= nums[i]

    return result
\`\`\`

**Key insight:** result[i] = (product of all left of i) × (product of all right of i). Two separate passes accumulate each half directly into the output array, achieving O(1) extra space.`,
  },
  {
    id: "blind75-005",
    solution: `### Solution

**Approach:** Kadane's algorithm — **Time:** O(n) | **Space:** O(1)

\`\`\`python
def maxSubArray(nums: list[int]) -> int:
    max_sum = nums[0]
    current = nums[0]
    for n in nums[1:]:
        current = max(n, current + n)   # extend OR restart fresh
        max_sum = max(max_sum, current)
    return max_sum
\`\`\`

**Key insight:** At every position, either extend the running subarray (\`current + n\`) or restart from the current element alone (\`n\`). Restarting is optimal whenever the running sum is negative — it can only drag the total down.`,
  },
  {
    id: "blind75-006",
    solution: `### Solution

**Approach:** Sort by start, then linear merge — **Time:** O(n log n) | **Space:** O(n)

\`\`\`python
def merge(intervals: list[list[int]]) -> list[list[int]]:
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:               # overlaps last merged
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
\`\`\`

**Key insight:** After sorting by start time, any interval that overlaps the previous one must immediately follow it. Walk left-to-right, extending the last merged interval's end whenever the next interval starts at or before it.`,
  },
  {
    id: "blind75-007",
    solution: `### Solution

**Approach:** Stack — **Time:** O(n) | **Space:** O(n)

\`\`\`python
def isValid(s: str) -> bool:
    stack = []
    pairs = {")": "(", "}": "{", "]": "["}
    for ch in s:
        if ch in pairs:                       # closing bracket
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()
        else:
            stack.append(ch)                  # opening bracket
    return not stack                          # stack must be empty
\`\`\`

**Key insight:** Push opening brackets. For each closing bracket, the top of the stack must be its matching opener — if not, the string is invalid. At the end, all openers must have been matched (empty stack).`,
  },
  {
    id: "blind75-008",
    solution: `### Solution

**Approach:** Sliding window with last-seen index map — **Time:** O(n) | **Space:** O(min(n, m))

\`\`\`python
def lengthOfLongestSubstring(s: str) -> int:
    last_seen = {}   # char → most recent index
    left = 0
    max_len = 0
    for right, ch in enumerate(s):
        if ch in last_seen and last_seen[ch] >= left:
            left = last_seen[ch] + 1   # jump past the duplicate
        last_seen[ch] = right
        max_len = max(max_len, right - left + 1)
    return max_len
\`\`\`

**Key insight:** Maintain a window [left, right] with no duplicates. When a duplicate character is found, jump \`left\` directly past its previous occurrence instead of shrinking one-by-one. This makes every character processed in O(1) amortised.`,
  },
  {
    id: "blind75-009",
    solution: `### Solution

**Approach:** Character frequency count — **Time:** O(n) | **Space:** O(1) fixed alphabet

\`\`\`python
from collections import Counter

def isAnagram(s: str, t: str) -> bool:
    return len(s) == len(t) and Counter(s) == Counter(t)

# Without Counter — single frequency array:
def isAnagram2(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    count = [0] * 26
    for a, b in zip(s, t):
        count[ord(a) - ord("a")] += 1
        count[ord(b) - ord("a")] -= 1
    return all(x == 0 for x in count)
\`\`\`

**Key insight:** Two strings are anagrams iff they contain identical character multisets. Count every character in \`s\` (+1) and \`t\` (−1) in one pass; if all counts are zero at the end, they match.`,
  },
  {
    id: "blind75-010",
    solution: `### Solution

**Approach:** Classic binary search — **Time:** O(log n) | **Space:** O(1)

\`\`\`python
def search(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2   # avoids integer overflow
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
\`\`\`

**Key insight:** Halve the search space every iteration. Use \`lo + (hi - lo) // 2\` instead of \`(lo + hi) // 2\` to prevent overflow in fixed-width integer languages. Loop terminates because lo > hi when the target is absent.`,
  },
  {
    id: "blind75-011",
    solution: `### Solution

**Approach:** Modified binary search — one half is always sorted — **Time:** O(log n) | **Space:** O(1)

\`\`\`python
def search(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:              # left half is sorted
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1                   # target in left half
            else:
                lo = mid + 1                   # target in right half
        else:                                  # right half is sorted
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1                   # target in right half
            else:
                hi = mid - 1                   # target in left half
    return -1
\`\`\`

**Key insight:** Even after rotation, exactly one of the two halves around \`mid\` is guaranteed to be sorted. Check which half is sorted first, then determine whether the target lies within it to decide which side to search.`,
  },
  {
    id: "blind75-012",
    solution: `### Solution

**Approach:** DFS (recursive) — **Time:** O(n) | **Space:** O(h) call stack

\`\`\`python
def maxDepth(root) -> int:
    if not root:
        return 0
    return 1 + max(maxDepth(root.left), maxDepth(root.right))

# Iterative BFS (level-order count):
from collections import deque
def maxDepthBFS(root) -> int:
    if not root:
        return 0
    depth, q = 0, deque([root])
    while q:
        depth += 1
        for _ in range(len(q)):
            node = q.popleft()
            if node.left:  q.append(node.left)
            if node.right: q.append(node.right)
    return depth
\`\`\`

**Key insight:** Depth of any node = 1 + max depth of its subtrees. Null nodes have depth 0. Call stack space is O(h) — O(log n) balanced, O(n) worst-case skewed tree.`,
  },
  {
    id: "blind75-013",
    solution: `### Solution

**Approach:** Recursive post-order swap — **Time:** O(n) | **Space:** O(h)

\`\`\`python
def invertTree(root):
    if not root:
        return None
    root.left, root.right = invertTree(root.right), invertTree(root.left)
    return root

# Iterative BFS:
from collections import deque
def invertTreeBFS(root):
    if not root: return root
    q = deque([root])
    while q:
        node = q.popleft()
        node.left, node.right = node.right, node.left
        if node.left:  q.append(node.left)
        if node.right: q.append(node.right)
    return root
\`\`\`

**Key insight:** Recurse into both children first (post-order), then swap them. Each swap mirrors the subtree rooted at that node. Works equally well with BFS — swap when you pop, push the (now-swapped) children.`,
  },
  {
    id: "blind75-014",
    solution: `### Solution

**Approach:** DFS with valid (min, max) bounds — **Time:** O(n) | **Space:** O(h)

\`\`\`python
def isValidBST(root) -> bool:
    def validate(node, lo, hi):
        if not node:
            return True
        if not (lo < node.val < hi):
            return False
        return (validate(node.left,  lo,       node.val) and
                validate(node.right, node.val, hi))

    return validate(root, float("-inf"), float("inf"))
\`\`\`

**Key insight:** A node is valid only if its value lies strictly within the bounds inherited from its ancestors. Going left tightens the upper bound; going right tightens the lower bound. The naive approach of only comparing parent–child fails for deeper violations (e.g., a right-subtree node whose value is less than a grandparent).`,
  },
  {
    id: "blind75-015",
    solution: `### Solution

**Approach:** DFS flood fill — **Time:** O(m×n) | **Space:** O(m×n) recursion

\`\`\`python
def numIslands(grid: list[list[str]]) -> int:
    rows, cols = len(grid), len(grid[0])

    def dfs(r, c):
        if r < 0 or r >= rows or c < 0 or c >= cols or grid[r][c] != "1":
            return
        grid[r][c] = "0"              # sink visited land
        dfs(r+1,c); dfs(r-1,c); dfs(r,c+1); dfs(r,c-1)

    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                count += 1
                dfs(r, c)             # sink the whole island
    return count
\`\`\`

**Key insight:** Each time you find unvisited land, it's a new island. DFS/BFS from that cell marks all connected land as water ('0') so it won't be counted again. The number of times you enter the DFS from the outer loop equals the island count.`,
  },
  {
    id: "blind75-016",
    solution: `### Solution

**Approach:** BFS with original→clone hash map — **Time:** O(V+E) | **Space:** O(V)

\`\`\`python
from collections import deque

def cloneGraph(node):
    if not node:
        return None
    clones = {node: type(node)(node.val)}   # original → clone
    q = deque([node])
    while q:
        curr = q.popleft()
        for neighbor in curr.neighbors:
            if neighbor not in clones:
                clones[neighbor] = type(neighbor)(neighbor.val)
                q.append(neighbor)
            clones[curr].neighbors.append(clones[neighbor])
    return clones[node]
\`\`\`

**Key insight:** The hash map serves two purposes: it avoids infinite loops in cyclic graphs (already-cloned nodes are skipped) and lets you wire up the clone's neighbor list by looking up each original neighbor's corresponding clone.`,
  },
  {
    id: "blind75-017",
    solution: `### Solution

**Approach:** Fibonacci DP, two variables — **Time:** O(n) | **Space:** O(1)

\`\`\`python
def climbStairs(n: int) -> int:
    if n <= 2:
        return n
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b
\`\`\`

**Why it's Fibonacci:** To reach step n you either took 1 step from n-1 or 2 steps from n-2. So \`ways(n) = ways(n-1) + ways(n-2)\`. Base cases: ways(1)=1, ways(2)=2. Rolling two variables means O(1) space.`,
  },
  {
    id: "blind75-018",
    solution: `### Solution

**Approach:** Bottom-up DP (unbounded knapsack) — **Time:** O(amount × n) | **Space:** O(amount)

\`\`\`python
def coinChange(coins: list[int], amount: int) -> int:
    dp = [float("inf")] * (amount + 1)
    dp[0] = 0                             # 0 coins needed for amount 0
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != float("inf") else -1
\`\`\`

**Key insight:** \`dp[i]\` = fewest coins to make amount \`i\`. For each sub-amount, try subtracting every coin denomination and take the best: \`dp[i] = min(dp[i-c] + 1)\` over all coins \`c ≤ i\`. Start from 0 and build up — each sub-problem is solved before it's needed.`,
  },
  {
    id: "blind75-019",
    solution: `### Solution

**Approach:** 2D DP table — **Time:** O(m×n) | **Space:** O(m×n) (reducible to O(n))

\`\`\`python
def longestCommonSubsequence(text1: str, text2: str) -> int:
    m, n = len(text1), len(text2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if text1[i-1] == text2[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1   # characters match: extend
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])  # skip one char
    return dp[m][n]
\`\`\`

**Key insight:** \`dp[i][j]\` = LCS of the first \`i\` chars of text1 and first \`j\` chars of text2. If the current characters match, extend the diagonal (shorter prefixes). If not, take the best of skipping one character from either string. Answer is in the bottom-right corner.`,
  },
  {
    id: "blind75-020",
    solution: `### Solution

**Approach:** Iterative in-place pointer reversal — **Time:** O(n) | **Space:** O(1)

\`\`\`python
def reverseList(head):
    prev, curr = None, head
    while curr:
        nxt = curr.next     # save forward link
        curr.next = prev    # flip pointer
        prev = curr         # advance prev
        curr = nxt          # advance curr
    return prev             # prev is the new head

# Recursive (O(h) call-stack space):
def reverseListRec(head):
    if not head or not head.next:
        return head
    new_head = reverseListRec(head.next)
    head.next.next = head
    head.next = None
    return new_head
\`\`\`

**Key insight:** Walk the list, flipping each \`next\` pointer backward. Three-variable dance: \`prev\` (already reversed), \`curr\` (being processed), \`nxt\` (not yet seen). After the loop, \`prev\` points to the original tail, now the new head.`,
  },
  {
    id: "blind75-021",
    solution: `### Solution

**Approach:** Floyd's tortoise-and-hare — **Time:** O(n) | **Space:** O(1)

\`\`\`python
def hasCycle(head) -> bool:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False

# Follow-up: find the cycle entry node
def detectCycle(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
        if slow is fast:
            slow = head          # reset one pointer to head
            while slow is not fast:
                slow = slow.next
                fast = fast.next
            return slow          # meeting point = cycle entry
    return None
\`\`\`

**Key insight:** Fast pointer moves 2×; slow moves 1×. If a cycle exists, fast laps slow inside the loop — they must meet. For finding the entry: after meeting, reset one pointer to head and advance both by 1. They meet at the cycle start (the math works out: distance-from-head-to-entry = distance-from-meeting-point-to-entry modulo cycle length).`,
  },
  {
    id: "blind75-022",
    solution: `### Solution

**Approach:** DFS with 3-color state (white / grey / black) — **Time:** O(V+E) | **Space:** O(V+E)

\`\`\`python
from collections import defaultdict

def canFinish(numCourses: int, prerequisites: list[list[int]]) -> bool:
    graph = defaultdict(list)
    for course, prereq in prerequisites:
        graph[prereq].append(course)   # prereq → course

    # 0=unvisited, 1=in current DFS path, 2=fully explored
    state = [0] * numCourses

    def dfs(node) -> bool:
        if state[node] == 1: return False  # back edge → cycle
        if state[node] == 2: return True   # already safe
        state[node] = 1
        for nb in graph[node]:
            if not dfs(nb): return False
        state[node] = 2
        return True

    return all(dfs(i) for i in range(numCourses))
\`\`\`

**Key insight:** Grey (state=1) nodes are currently on the DFS stack. Reaching a grey node means you found a back edge → cycle → impossible to finish. Black (state=2) nodes are fully explored and safe. If no grey node is ever re-visited, the graph is a DAG and all courses can be completed.`,
  },
  {
    id: "blind75-023",
    solution: `### Solution

**Approach:** Exploit BST ordering — iterative — **Time:** O(h) | **Space:** O(1)

\`\`\`python
def lowestCommonAncestor(root, p, q):
    curr = root
    while curr:
        if p.val < curr.val and q.val < curr.val:
            curr = curr.left         # both in left subtree
        elif p.val > curr.val and q.val > curr.val:
            curr = curr.right        # both in right subtree
        else:
            return curr              # they diverge here (or one equals root)
\`\`\`

**Key insight:** In a BST, if both target values are smaller than the current node, the LCA must be in the left subtree; if both are larger, go right. The first node where p and q land on opposite sides (or one matches the node) is the LCA. No recursion or extra space needed.`,
  },
];

/* ── Runner ─────────────────────────────────────────────────────── */

const db = openDb();
let updated = 0;
let skipped = 0;

for (const { id, solution } of SOLUTIONS) {
  const row = db
    .prepare("SELECT body_md FROM cards WHERE id = ?")
    .get(id) as { body_md: string } | undefined;

  if (!row) {
    console.log(`  [!] Missing card: ${id}`);
    skipped++;
    continue;
  }

  // Replace ### Hints or ### Solution section (whichever comes first at end of string)
  const cutIdx = row.body_md.search(/\n### (Hints|Solution)/);
  const newBody =
    cutIdx >= 0
      ? row.body_md.slice(0, cutIdx) + "\n\n" + solution
      : row.body_md + "\n\n" + solution;

  db.prepare("UPDATE cards SET body_md = ? WHERE id = ?").run(newBody, id);
  console.log(`  [✓] ${id}`);
  updated++;
}

console.log(`\nDone — updated ${updated}, skipped ${skipped}.`);
closeDb();
