# Security Specification: Assistant Queries Collection

## 1. Data Invariants
- **Authentication**: No authentication is required for this app (syncKey-based multi-device synchronization).
- **ID Validation**: Document IDs must be valid alphanumeric strings.
- **Strict Keys**: Documents must only contain: `syncKey`, `query`, `responseJson`, `timestamp`, `createdAt`.
- **Field Constraints**:
  - `syncKey`: string, size <= 100
  - `query`: string, size <= 2000
  - `responseJson`: string, size <= 100000
  - `timestamp`: number (integer)
  - `createdAt`: timestamp, must equal `request.time`
- **Allowed Operations**:
  - `create`: Allowed if schema and invariants are satisfied.
  - `get`: Allowed.
  - `list`: Allowed if query filters on `syncKey` (i.e. `resource.data.syncKey` is present and matches the rules).
  - `update`: Forbidden (documents are immutable).
  - `delete`: Forbidden.

---

## 2. The "Dirty Dozen" Payloads (Deny Cases)
These payloads must be rejected by the Firestore rules:

1. **Payload 1: Missing `syncKey`**
   ```json
   {
     "query": "Hello",
     "responseJson": "{}",
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
2. **Payload 2: `syncKey` is a number**
   ```json
   {
     "syncKey": 12345,
     "query": "Hello",
     "responseJson": "{}",
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
3. **Payload 3: `syncKey` exceeds 100 characters**
   ```json
   {
     "syncKey": "user_too_long_sync_key_123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
     "query": "Hello",
     "responseJson": "{}",
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
4. **Payload 4: Missing `query`**
   ```json
   {
     "syncKey": "user_abc",
     "responseJson": "{}",
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
5. **Payload 5: `query` is an array**
   ```json
   {
     "syncKey": "user_abc",
     "query": ["Hello"],
     "responseJson": "{}",
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
6. **Payload 6: `query` exceeds 2000 characters**
   ```json
   {
     "syncKey": "user_abc",
     "query": "[Repeated character of length > 2000]",
     "responseJson": "{}",
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
7. **Payload 7: Missing `responseJson`**
   ```json
   {
     "syncKey": "user_abc",
     "query": "Hello",
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
8. **Payload 8: `responseJson` is boolean**
   ```json
   {
     "syncKey": "user_abc",
     "query": "Hello",
     "responseJson": true,
     "timestamp": 1719273600000,
     "createdAt": "request.time"
   }
   ```
9. **Payload 9: Extra unexpected field (Shadow field/Ghost write)**
   ```json
   {
     "syncKey": "user_abc",
     "query": "Hello",
     "responseJson": "{}",
     "timestamp": 1719273600000,
     "createdAt": "request.time",
     "isAdmin": true
   }
   ```
10. **Payload 10: Missing `timestamp`**
    ```json
    {
      "syncKey": "user_abc",
      "query": "Hello",
      "responseJson": "{}",
      "createdAt": "request.time"
    }
    ```
11. **Payload 11: Missing `createdAt` or spoofed timestamp**
    ```json
    {
      "syncKey": "user_abc",
      "query": "Hello",
      "responseJson": "{}",
      "timestamp": 1719273600000,
      "createdAt": 1719273600000
    }
    ```
12. **Payload 12: Attempt to update record**
    ```json
    {
      "syncKey": "user_abc",
      "query": "Hello Updated",
      "responseJson": "{}",
      "timestamp": 1719273600000,
      "createdAt": "request.time"
    }
    ```

---

## 3. Test Runner
Below is the validation strategy. Every write must be checked against `isValidAssistantQuery()` and every update/delete must be denied.
