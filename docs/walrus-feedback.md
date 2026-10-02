# Walrus feedback

These notes come from implementing the MemWal adapter against the published API at [docs.wal.app](https://docs.wal.app/walrus-memory/sdk/api-reference). This workspace did not have `MEMWAL_PRIVATE_KEY` or `MEMWAL_ACCOUNT_ID`, so no live remember, recall, or latency measurement was run. Nothing below is an invented runtime failure.

## Setup

The SDK is `@mysten-incubation/memwal`. A delegate key and account id come from the hosted dashboard. The client signs requests. `health()` does not prove the key is valid; the docs say a signed call can still return 401 after a healthy check.

## API shape

`remember` / `rememberAndWait` and `recall` are the operations Frimz uses. There is no update method. Blobs are content-addressed and immutable, so an edit in Frimz writes a new blob and marks the previous index row superseded.

`recall` searches by meaning. It does not list a namespace. The Memory page therefore reads `memory_index`. The docs also warn that a newest-wins sort of a small cosine result set can miss the newer record, which is why superseded rows are filtered in the application even if an old blob still matches.

## Delete

Programmatic deletion is the Security Delete API: a wallet challenge, an age cutoff, and a sponsored batch transaction. That is not a `delete(id)` call with the delegate key. Frimz forget marks the index row `forgotten` and stops retrieval. The UI does not claim the blob was removed.

## Namespaces

Recall is scoped by owner and namespace. Frimz puts each user in `frimz-user-{userId}` and never accepts a namespace from the browser.

## Not yet observed

Latency, extraction quality of the relayer's own `analyze()` path (Frimz does not call it), and renewal before epoch expiry were not measured here. Frimz points at the testnet relayer `https://relayer-staging.memory.walrus.xyz`. Testnet epochs last about a day.
