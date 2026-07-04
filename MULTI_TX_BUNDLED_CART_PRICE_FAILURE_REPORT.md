# Multi-Tx Bundled Cart Price Failure Report

Date: 2026-07-03

## Summary

A bundled cart transaction failed during Plutus evaluation on the first built
transaction, `build0`. The failing spend validators both reported:

```txt
Fail: offer_taken * price <= ask_given
```

The fill quote arithmetic in the provided cart args is internally consistent.
Each `ask-quantity` satisfies the one-way swap validator price inequality when
checked against the corresponding `offer-quantity`, `price-numerator`, and
`price-denominator`.

The likely bug is transaction value accounting in the fill fragment: the
continuing swap output appears to set the ask asset quantity to only the new
ask deposit, instead of preserving any ask asset already present in the input
UTxO and adding the new ask deposit.

## Findings

1. The quoted ask quantities are correct.

   Direct checks from the provided item args:

   ```txt
   item 0: offer=5138421, price=98123/360000, ask=1400549, required=1400549, ok=true
   item 1: offer=8955891, price=492353/1800000, ask=2449700, required=2449700, ok=true
   item 2: offer=9129051, price=197311/720000, ask=2501754, required=2501754, ok=true
   item 3: offer=1996093, price=39533/144000, ask=547997, required=547997, ok=true
   ```

2. The failing trace is not a quote-rounding issue.

   The minimum ask was computed with ceiling arithmetic:

   ```txt
   required_ask = ceil(offer_taken * price_numerator / price_denominator)
   ```

   Every supplied `ask-quantity` matched that required ask.

3. The continuing output likely under-reports `ask_given`.

   For a partially filled one-way swap, the continuing output must preserve any
   ask asset already accumulated in the consumed swap UTxO and add the new ask
   payment:

   ```txt
   continuing_ask_quantity = current_input_ask_quantity + new_ask_quantity
   ```

   The generated fragment uses only:

   ```txt
   continuing_ask_quantity = args.ask-quantity
   ```

   If the consumed UTxO already contains ask assets, the validator sees less ask
   entering the continuing output than the transaction intended.

4. Full-fill handling is a separate risk.

   In the provided `build0`, several ADA-offer fills fully consume the offer
   quantity and produce a zero remaining offer. The fragment still emits a
   `remainingOfferWithBeacons` output. That is suspicious and should be handled
   deliberately, but the reported validator trace points first to ask-delta
   accounting.

## Suggested Fix

1. Add current ask quantity to fill protocol args.

   Example:

   ```json
   {
     "utxo-ask-quantity": "0"
   }
   ```

   This should be sourced from the normalized live UTxO value, not inferred from
   UI state or prior wallet return data.

2. Update `src/intents/lib/swap.gcscript.jsonc` so ask output quantity is:

   ```txt
   addBigNum(args.utxo-ask-quantity, args.ask-quantity)
   ```

3. Preserve the ADA/native split:

   - If ask is ADA, fold the summed ask value into `remainingADA`.
   - If ask is a native asset, put the summed native asset quantity in the
     continuing output.

4. Keep all arithmetic in BigNum string space.

   Do not cast asset quantities, lovelace, price numerators, or denominators to
   JavaScript `number`.

5. Add a fill preflight assertion.

   The reusable fill fragment should assert that required current UTxO fields
   are present and valid before `plutusData` or `buildTx`:

   ```txt
   utxo-coin-quantity
   utxo-offer-quantity
   utxo-ask-quantity
   offer-quantity
   ask-quantity
   price-numerator
   price-denominator
   ```

6. Add explicit full-fill handling.

   When `remainingOffer == 0`, decide whether the correct protocol path is to
   avoid a continuing swap output and burn beacons, or keep the current temporary
   full-fill limitation. Do not silently emit a zero-offer continuing UTxO.

## Raw Error Fragment

```json
[
  {
    "path": "/build0",
    "type": "error",
    "message": "{\n  \"code\": \"plutus_evaluation_error\",\n  \"message\": \"Execution budget calculation: Some scripts of the transactions terminated with error(s).\",\n  \"more\": [\n    {\n      \"validator\": {\n        \"index\": 0,\n        \"purpose\": \"spend\"\n      },\n      \"error\": {\n        \"code\": 3012,\n        \"message\": \"Some of the scripts failed to evaluate to a positive outcome. The field 'data.validationError' informs about the nature of the error, and 'data.traces' lists all the execution traces collected during the script execution.\",\n        \"data\": {\n          \"validationError\": \"An error has occurred:\\nThe machine terminated because of an error, either from a built-in function or from an explicit use of 'error'.\\nCaused by: (error)\",\n          \"traces\": [\n            \"Fail: offer_taken * price &amp;lt;= ask_given\"\n          ]\n        }\n      }\n    },\n    {\n      \"validator\": {\n        \"index\": 5,\n        \"purpose\": \"spend\"\n      },\n      \"error\": {\n        \"code\": 3012,\n        \"message\": \"Some of the scripts failed to evaluate to a positive outcome. The field 'data.validationError' informs about the nature of the error, and 'data.traces' lists all the execution traces collected during the script execution.\",\n        \"data\": {\n          \"validationError\": \"An error has occurred:\\nThe machine terminated because of an error, either from a built-in function or from an explicit use of 'error'.\\nCaused by: (error)\",\n          \"traces\": [\n            \"Fail: offer_taken * price &amp;lt;= ask_given\"\n          ]\n        }\n      }\n    }\n  ]\n}",
    "time": 1783121926351
  }
]
```

## Raw Data Fragments

The prompt included a full wallet context and full generated GCScript. The most
diagnostic fragments are preserved here: the four fill item args, the resulting
`tx0` outputs, and the reusable swap fragment shape that creates the continuing
output.

### Fill Item Args

```json
[
  {
    "item-index": 0,
    "type": "fill",
    "protocol-args": {
      "offer-policy-id": "ada",
      "offer-asset-name": "ada",
      "ask-policy-id": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
      "ask-asset-name": "5553444d",
      "price-numerator": "98123",
      "price-denominator": "360000",
      "utxo-tx-hash": "62bdd574246969efd7c740736ca036bbfd4c4bb1772947660125a2594a2ad8ac",
      "utxo-tx-index": "8",
      "utxo-coin-quantity": "5138421",
      "utxo-offer-quantity": "5138421",
      "offer-quantity": "5138421",
      "ask-quantity": "1400549",
      "owner-stake-keyhash": "f3eb9839fb3be3e66b330bc9d3213d498c3d61a1fe4b33699f04dce5",
      "intent-id": "62bdd574-8-1783121841093-bcdebea3"
    }
  },
  {
    "item-index": 1,
    "type": "fill",
    "protocol-args": {
      "offer-policy-id": "ada",
      "offer-asset-name": "ada",
      "ask-policy-id": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
      "ask-asset-name": "5553444d",
      "price-numerator": "492353",
      "price-denominator": "1800000",
      "utxo-tx-hash": "879f374ebb5b593d4a0bd36a4c2920e9a721e1b2e0f5bacc5e39dfe433ae0b10",
      "utxo-tx-index": "2",
      "utxo-coin-quantity": "8955891",
      "utxo-offer-quantity": "8955891",
      "offer-quantity": "8955891",
      "ask-quantity": "2449700",
      "owner-stake-keyhash": "f3eb9839fb3be3e66b330bc9d3213d498c3d61a1fe4b33699f04dce5",
      "intent-id": "879f374e-2-1783121841093-cbf08aed"
    }
  },
  {
    "item-index": 2,
    "type": "fill",
    "protocol-args": {
      "offer-policy-id": "ada",
      "offer-asset-name": "ada",
      "ask-policy-id": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
      "ask-asset-name": "5553444d",
      "price-numerator": "197311",
      "price-denominator": "720000",
      "utxo-tx-hash": "879f374ebb5b593d4a0bd36a4c2920e9a721e1b2e0f5bacc5e39dfe433ae0b10",
      "utxo-tx-index": "1",
      "utxo-coin-quantity": "9129051",
      "utxo-offer-quantity": "9129051",
      "offer-quantity": "9129051",
      "ask-quantity": "2501754",
      "owner-stake-keyhash": "f3eb9839fb3be3e66b330bc9d3213d498c3d61a1fe4b33699f04dce5",
      "intent-id": "879f374e-1-1783121841093-67d7c2e3"
    }
  },
  {
    "item-index": 3,
    "type": "fill",
    "protocol-args": {
      "offer-policy-id": "ada",
      "offer-asset-name": "ada",
      "ask-policy-id": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
      "ask-asset-name": "5553444d",
      "price-numerator": "39533",
      "price-denominator": "144000",
      "utxo-tx-hash": "e0028e9d0bec9cb11827213fb52ff5d928e2cf221a1896846dc079cdb2099632",
      "utxo-tx-index": "3",
      "utxo-coin-quantity": "7580669",
      "utxo-offer-quantity": "7580669",
      "offer-quantity": "1996093",
      "ask-quantity": "547997",
      "owner-stake-keyhash": "f3eb9839fb3be3e66b330bc9d3213d498c3d61a1fe4b33699f04dce5",
      "intent-id": "e0028e9d-3-1783121841093-e3bc294d"
    }
  }
]
```

### Generated `tx0` Output Pattern

```json
{
  "tx0": {
    "outputs": [
      {
        "idPattern": "P2PDeFiKernel-OWS-swap-62bdd574-8-1783121841093-bcdebea3-filledOffer",
        "address": "addr_test1qrv2myc3je5q7fxfnajjgj4qnynhdp82rsylnj2lm8yawthnawvrn7emu0nxkvcte8fjz02f3s7krg07fvekn8cymnjsn0kg5x",
        "assets": [
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "5138421"
          }
        ]
      },
      {
        "idPattern": "P2PDeFiKernel-OWS-swap-62bdd574-8-1783121841093-bcdebea3-remainingOfferWithBeacons",
        "assets": [
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "0"
          },
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "0"
          },
          {
            "policyId": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
            "assetNameHex": "5553444d",
            "quantity": "1400549"
          }
        ]
      },
      {
        "idPattern": "P2PDeFiKernel-OWS-swap-879f374e-2-1783121841093-cbf08aed-remainingOfferWithBeacons",
        "assets": [
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "0"
          },
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "0"
          },
          {
            "policyId": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
            "assetNameHex": "5553444d",
            "quantity": "2449700"
          }
        ]
      },
      {
        "idPattern": "P2PDeFiKernel-OWS-swap-879f374e-1-1783121841093-67d7c2e3-remainingOfferWithBeacons",
        "assets": [
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "0"
          },
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "0"
          },
          {
            "policyId": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
            "assetNameHex": "5553444d",
            "quantity": "2501754"
          }
        ]
      },
      {
        "idPattern": "P2PDeFiKernel-OWS-swap-e0028e9d-3-1783121841093-e3bc294d-remainingOfferWithBeacons",
        "assets": [
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "5584576"
          },
          {
            "policyId": "ada",
            "assetNameHex": "ada",
            "quantity": "0"
          },
          {
            "policyId": "d4fece6b39f7cd78a3f036b2ae6508c13524b863922da80f68dd9ab7",
            "assetNameHex": "5553444d",
            "quantity": "547997"
          }
        ]
      }
    ]
  }
}
```

### Reusable Swap Fragment Pattern

```json
{
  "quantity": {
    "type": "macro",
    "run": {
      "ask": {
        "ada-ada": "0",
        "{join('-', get('args.ask-policy-id'), get('args.ask-asset-name'))}": "{get('args.ask-quantity')}"
      },
      "offer": {
        "ada-ada": "0",
        "{join('-', get('args.offer-policy-id'), get('args.offer-asset-name'))}": "{get('args.offer-quantity')}"
      },
      "utxo": {
        "ada-ada": "{get('args.utxo-coin-quantity')}",
        "{join('-', get('args.offer-policy-id'), get('args.offer-asset-name'))}": "{get('args.utxo-offer-quantity')}"
      }
    }
  },
  "remainingADA": {
    "type": "macro",
    "run": "{subBigNum(addBigNum(get('cache.currentADA'), get('cache.quantity.ask.ada-ada')), get('cache.quantity.offer.ada-ada'))}"
  },
  "remainingOffer": {
    "type": "macro",
    "run": "{subBigNum(get('cache.currentOffer') , get('args.offer-quantity') )}"
  },
  "outputQuantity": {
    "type": "macro",
    "run": {
      "remainingOffer": {
        "{join('-', get('args.offer-policy-id'), get('args.offer-asset-name'))}": "{get('cache.remainingOffer')}",
        "ada-ada": "0"
      },
      "askDeposit": {
        "{join('-', get('args.ask-policy-id'), get('args.ask-asset-name'))}": "{get('args.ask-quantity')}",
        "ada-ada": "0"
      }
    }
  },
  "remainingOfferWithBeacons": {
    "assets": [
      {
        "policyId": "ada",
        "assetNameHex": "ada",
        "quantity": "{get('cache.remainingADA')}"
      },
      {
        "policyId": "{get('cache.dependencies.normalized.forTx.offer-policy-id')}",
        "assetNameHex": "{get('cache.dependencies.normalized.forTx.offer-asset-name')}",
        "quantity": "{get(join('.','cache','outputQuantity','remainingOffer', join('-',get('cache.dependencies.normalized.forTx.offer-policy-id'),get('cache.dependencies.normalized.forTx.offer-asset-name')) ))}"
      },
      {
        "policyId": "{get('cache.dependencies.normalized.forTx.ask-policy-id')}",
        "assetNameHex": "{get('cache.dependencies.normalized.forTx.ask-asset-name')}",
        "quantity": "{get(join('.','cache','outputQuantity','askDeposit', join('-',get('cache.dependencies.normalized.forTx.ask-policy-id'),get('cache.dependencies.normalized.forTx.ask-asset-name')) ))}"
      }
    ]
  }
}
```

## Verification Notes

Manual BigNum check used:

```js
const xs = [
  ['0', 5138421n, 98123n, 360000n, 1400549n],
  ['1', 8955891n, 492353n, 1800000n, 2449700n],
  ['2', 9129051n, 197311n, 720000n, 2501754n],
  ['3', 1996093n, 39533n, 144000n, 547997n],
];
for (const [id, offer, pn, pd, ask] of xs) {
  const lhs = offer * pn;
  const rhs = ask * pd;
  const ceil = (lhs + pd - 1n) / pd;
  console.log(id, lhs <= rhs, ceil.toString(), ask.toString());
}
```

Result:

```txt
0 true 1400549 1400549
1 true 2449700 2449700
2 true 2501754 2501754
3 true 547997 547997
```

## Caveat

The pasted wallet context and generated GCScript were larger than is practical
to duplicate verbatim in a hand-maintained report. This file preserves the full
error payload and the exact diagnostic fragments needed to explain and fix the
failure. If a future investigation needs byte-for-byte preservation of the
entire wallet context, export the raw wallet context JSON from the devtool into
`tmp/` or attach it as a fixture and reference it from this report.
