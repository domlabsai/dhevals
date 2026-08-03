process.env.DHEVALS_AUDIT_SUITE = 'benchmarks/suites/heavy-user-ptbr/v0.3/suite.json'
process.env.DHEVALS_AUDIT_FIXTURE = 'benchmarks/suites/heavy-user-ptbr/v0.3/fixtures/sacilm-calibration-fixture.json'
process.env.DHEVALS_AUDIT_NEGATIVE_FIXTURE = 'benchmarks/suites/heavy-user-ptbr/v0.3/fixtures/negative-fixture.json'
process.env.DHEVALS_AUDIT_RUBRIC = 'benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-rubric.json'
process.env.DHEVALS_AUDIT_EXAMPLES = 'benchmarks/calibration/heavy-user-ptbr/v0.3/anchor-examples.json'
process.env.DHEVALS_AUDIT_REGISTRY = 'benchmarks/comparisons/v0.3/models.json'
process.env.DHEVALS_AUDIT_OUTPUT = 'reports/audits/heavy-user-ptbr-v0.3.json'
process.env.DHEVALS_AUDIT_PUBLIC_OUTPUT = 'reports/audits/heavy-user-ptbr-v0.3-public.json'

await import('./audit-benchmarks.mjs')
