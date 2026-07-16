# CardanoSwaps Validator State

Generated on 2026-07-16 from live MKII endpoints:

Scope: NeonSoup current one-way deployment plus official CardanoSwaps v1/v2
one-way and two-way validators. Live UTxOs are counted by beacon policy with
quantity `1` and inline datum present. ADA locked is the sum of live UTxO
`value`. Token counts exclude beacon-policy tokens and count distinct
non-beacon native assets.

## Mainnet

| Validator | Kind / status | Spending validator hash | Beacon policy hash | Deployed/reference UTxO | UTxOs | Addresses | ADA locked | Token assets | Tokens found |
|---|---|---|---|---|---:|---:|---:|---:|---|
| NeonSoup current one-way | one-way<br>current NeonSoup | `1d6cff26bcab91d2061aad0bd259cbb7d76d25ced2eeaed5926a42ad` | `c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209` | configured spending: `7b613fc2481a93b950f3bf48f8fbc5c49d6decce126a3572fab428feb73ed5b0#1`, beacon: `7b613fc2481a93b950f3bf48f8fbc5c49d6decce126a3572fab428feb73ed5b0#0`<br>MKII spending: `8ae2d109559ce82e9fb067dc361693d28219a675a1b9d95b4ad5aa73bfbae7a5#0`, `9b8b0e3544e9adc23a2e24df4365a8adcf671f4fe65fee3e52503a486cc2f026#0`; beacon: `9b8b0e3544e9adc23a2e24df4365a8adcf671f4fe65fee3e52503a486cc2f026#1`, `b6125af19042ff26084f16586622a8ee0face80d1c67329f50fb2a50dd7ae0bd#0` | 4 | 3 | 24.624708 | 3 | cMATRA (188339000000), USDM (808480), FRENCHIE WIFF (3) |
| CardanoSwaps v1 one-way audited | one-way<br>official v1 audited | `01fa36465dfe36e26c21fdbf720e4bdafcc0b86bb5367fca46012f56` | `47cec2a1404ed91fc31124f29db15dc1aae77e0617868bcef351b8fd` | not found via MKII | 0 | 0 | 0.000000 | 0 | - |
| CardanoSwaps v1 two-way audited | two-way<br>official v1 audited | `87381f0bf416e2dae7497d3fcd8087cf677b3cb4b2aeba36ed8f8f79` | `84662c22dc5c0cadad7b2ebf9757ce9ea61dbd8fe64bc8c43c112a40` | not found via MKII | 0 | 0 | 0.000000 | 0 | - |
| CardanoSwaps v2 one-way PlutusV3 | one-way<br>official v2 live not audited | `ef69e7b2174184c1a1e140f255af81bb6a8daf7d3796563ec7bdeccb` | `4557249e92a42c371f494c32fcfbb31648ef14c4fb69056e56269af3` | not found via MKII | 0 | 0 | 0.000000 | 0 | - |
| CardanoSwaps v2 two-way PlutusV3 | two-way<br>official v2 live not audited | `81bd68c4428281814bb2c69d75af4bc45876dfdc0af82c1ed4b8a8b4` | `ca68d83fa7afe2dab5bfdaa9ee2fd5e0dc584f0d5cbbac887c2b77a2` | not found via MKII | 0 | 0 | 0.000000 | 0 | - |

## Preprod

| Validator | Kind / status | Spending validator hash | Beacon policy hash | Deployed/reference UTxO | UTxOs | Addresses | ADA locked | Token assets | Tokens found |
|---|---|---|---|---|---:|---:|---:|---:|---|
| NeonSoup current one-way | one-way<br>current NeonSoup | `1d6cff26bcab91d2061aad0bd259cbb7d76d25ced2eeaed5926a42ad` | `c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209` | configured spending: `9b8b0e3544e9adc23a2e24df4365a8adcf671f4fe65fee3e52503a486cc2f026#0`, beacon: `9b8b0e3544e9adc23a2e24df4365a8adcf671f4fe65fee3e52503a486cc2f026#1`<br>MKII spending: `2546861b18243b0b6ea9b396c6a120b2ceb1038317e8736171a37498a55c6493#1`, `396ec10bc872c96592f4d5a1949e70607e37d6809005c6a336a3d668d16efebc#0`, `7b613fc2481a93b950f3bf48f8fbc5c49d6decce126a3572fab428feb73ed5b0#1` ...; beacon: `2546861b18243b0b6ea9b396c6a120b2ceb1038317e8736171a37498a55c6493#0`, `7b613fc2481a93b950f3bf48f8fbc5c49d6decce126a3572fab428feb73ed5b0#0`, `b1d92732ba5392ba76129360bb838f80c0177a71f757dcec58e3f15b8aa1b3fe#1` | 276 | 6 | 1355.770824 | 5 | USDM (31271925), GFILL (600), ADAM (50), TEST (34), GameChangerToken (1) |
| CardanoSwaps v1 one-way audited | one-way<br>official v1 audited | `01fa36465dfe36e26c21fdbf720e4bdafcc0b86bb5367fca46012f56` | `47cec2a1404ed91fc31124f29db15dc1aae77e0617868bcef351b8fd` | MKII spending: `02577cdc4704b5cf00e0a2d2d84e35ab8b27449d5ec4afb342147881c4f91867#1`, `95844b47daebc6bdfea65291fa04c225041fc98dff026bd7be4507160c588e99#1`, `9fecc1d2cf99088facad02aeccbedb6a4f783965dc6c02bd04dc8b348e9a0858#0` ...; beacon: `02577cdc4704b5cf00e0a2d2d84e35ab8b27449d5ec4afb342147881c4f91867#0`, `95844b47daebc6bdfea65291fa04c225041fc98dff026bd7be4507160c588e99#0`, `9fecc1d2cf99088facad02aeccbedb6a4f783965dc6c02bd04dc8b348e9a0858#1` ... | 22 | 9 | 398.019174 | 6 | TestToken1 (8414), TestDJED (3862), TestUSDM (2020), tPEER (977), OtherToken (201), tMILKv2 (109) |
| CardanoSwaps v1 two-way audited | two-way<br>official v1 audited | `87381f0bf416e2dae7497d3fcd8087cf677b3cb4b2aeba36ed8f8f79` | `84662c22dc5c0cadad7b2ebf9757ce9ea61dbd8fe64bc8c43c112a40` | MKII spending: `115c9ebb9928b8ec6e0c9d1420c43421cfb323639dd9fdcf1e7155e73bec13c5#0`, `18635acf02ec1d5876525d3f2fc6d4ea06ae0e47f907e92c32ab3804eb589759#1`, `3d733849c9bc1bfd57fdf0caf00207599171280f1eba4a0053edb56ade7e915a#1` ...; beacon: `115c9ebb9928b8ec6e0c9d1420c43421cfb323639dd9fdcf1e7155e73bec13c5#1`, `18635acf02ec1d5876525d3f2fc6d4ea06ae0e47f907e92c32ab3804eb589759#0`, `58885445a71299eb22bb01962d4e1257fbd0253f304e28cf6ce0bf2041c5cf47#0` ... | 38 | 6 | 1609.234051 | 8 | MyUSD (10000000000), DjedMicroUSD (10000000000), TestUSDM (196192), TestDJED (105552), OtherToken (81760), TestToken1 (51810), tMILKv2 (1763), tPEER (240) |
| CardanoSwaps v2 one-way PlutusV3 | one-way<br>official v2 live not audited | `ef69e7b2174184c1a1e140f255af81bb6a8daf7d3796563ec7bdeccb` | `4557249e92a42c371f494c32fcfbb31648ef14c4fb69056e56269af3` | MKII spending: `049ea637add8e086c4417e701702837242202ae53dbbde193eab0dad12a499e3#0`; beacon: `049ea637add8e086c4417e701702837242202ae53dbbde193eab0dad12a499e3#1` | 0 | 0 | 0.000000 | 0 | - |
| CardanoSwaps v2 two-way PlutusV3 | two-way<br>official v2 live not audited | `81bd68c4428281814bb2c69d75af4bc45876dfdc0af82c1ed4b8a8b4` | `ca68d83fa7afe2dab5bfdaa9ee2fd5e0dc584f0d5cbbac887c2b77a2` | MKII spending: `7e7da038640d4ba0da945892b6217ba216432a602c84099a645729106ec1d295#0`; beacon: `7e7da038640d4ba0da945892b6217ba216432a602c84099a645729106ec1d295#1` | 0 | 0 | 0.000000 | 0 | - |

## Notes

- `not found via MKII` under deployed/reference UTxO means no live UTxO with a
  matching reference script hash was returned by the queried MKII endpoint. It
  does not prove the script was never deployed historically.
- Official v1 preprod rows are the only official CardanoSwaps rows with
  meaningful live liquidity in this scan. Official v1/v2 mainnet rows returned
  zero live UTxOs on the queried MKII instance.
- NeonSoup current mainnet rows are on the older one-way validator set and
  include a small number of UTxOs, matching the current app deployment
  preference.
