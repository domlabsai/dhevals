process.env.DHEVALS_V03_FIXTURE = 'benchmarks/suites/heavy-user-ptbr/v0.3/fixtures/negative-fixture.json'
process.env.DHEVALS_V03_OUTPUT_STEM = 'sacilm-heavy-user-negative-v0.3'
process.env.DHEVALS_V03_MODEL_ID = 'negative-fixture-v0.3'
process.env.DHEVALS_V03_CHECKPOINT = 'negative-fixture-v0.3'
process.env.DHEVALS_V03_TRAINING_COMMIT = 'negative-fixture-v0.3'
process.env.DHEVALS_V03_RUN_ID = 'negative-fixture-v0.3'

await import('./run-heavy-user-v03-fixture.mjs')
