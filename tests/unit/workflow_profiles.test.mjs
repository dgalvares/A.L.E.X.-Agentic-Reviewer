import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';

const workflowPaths = [
  '.github/workflows/alex-pr-review.yml',
  '.github/workflows/alex-pr-review.consumer.yml',
];

test('GitHub workflows pass dynamic agent profile variables to alex ci', () => {
  for (const workflowPath of workflowPaths) {
    const source = fs.readFileSync(workflowPath, 'utf8');
    const workflow = YAML.parse(source);
    const steps = workflow.jobs['alex-pr-review'].steps;
    const profileStep = steps.find((step) => step.id === 'agent-profile');
    const runStep = steps.find((step) => step.run?.includes('--diff-file pr.diff'));

    assert.ok(profileStep, `${workflowPath} should resolve comment agent profile`);
    assert.equal(profileStep.env.DEFAULT_ALEX_AGENTS, "${{ vars.ALEX_AGENTS || 'default' }}");
    assert.equal(profileStep.env.DEFAULT_ALEX_DISABLED_AGENTS, "${{ vars.ALEX_DISABLED_AGENTS || '' }}");
    assert.match(profileStep.with.script, /readOption\('agents'\)/);
    assert.match(profileStep.with.script, /readOption\('disable-agents'\)/);
    assert.match(profileStep.with.script, /restTokens\.length === 1/);
    assert.match(profileStep.with.script, /core\.warning/);
    assert.match(profileStep.with.script, /alex\\s\+review/);
    assert.ok(runStep, `${workflowPath} should run alex ci`);
    assert.equal(runStep.env.ALEX_AGENTS, "${{ steps.agent-profile.outputs.agents }}");
    assert.equal(runStep.env.ALEX_DISABLED_AGENTS, "${{ steps.agent-profile.outputs.disabled-agents }}");
    assert.equal(runStep.env.REPORT_PATH, '${{ runner.temp }}/alex-review.md');
    assert.match(runStep.run, /--agents "\$ALEX_AGENTS"/);
    assert.match(runStep.run, /--disable-agents "\$ALEX_DISABLED_AGENTS"/);
    assert.match(runStep.run, /--fail-on-fail/);
    assert.match(runStep.run, /--output-file "\$REPORT_PATH"/);
  }
});

test('Internal workflow runs trusted A.L.E.X build outside the PR checkout', () => {
  const source = fs.readFileSync('.github/workflows/alex-pr-review.yml', 'utf8');
  const workflow = YAML.parse(source);
  const steps = workflow.jobs['alex-pr-review'].steps;

  const trustedCheckout = steps.find((step) => step.name === 'Checkout trusted A.L.E.X source');
  const targetCheckout = steps.find((step) => step.name === 'Checkout PR analysis target');
  const installStep = steps.find((step) => step.name === 'Install trusted A.L.E.X dependencies');
  const buildStep = steps.find((step) => step.name === 'Build trusted A.L.E.X');
  const runStep = steps.find((step) => step.name === 'Run A.L.E.X CI review');
  const diffStep = steps.find((step) => step.name === 'Capture PR diff');
  const commentStep = steps.find((step) => step.name === 'Comment review on PR');

  assert.equal(trustedCheckout.with.path, 'alex-tool');
  assert.equal(trustedCheckout.with.ref, '${{ github.event.repository.default_branch }}');
  assert.equal(targetCheckout.with.path, 'pr-target');
  assert.equal(installStep['working-directory'], 'alex-tool');
  assert.equal(buildStep['working-directory'], 'alex-tool');
  assert.match(diffStep.run, /rm -f pr\.diff "\$RUNNER_TEMP\/alex-review\.md"/);
  assert.equal(runStep['working-directory'], 'pr-target');
  assert.match(runStep.run, /node \.\.\/alex-tool\/dist\/cli\.js ci/);
  assert.equal(commentStep.if, "always() && steps.permission.outputs.allowed == 'true'");
  assert.equal(commentStep.env.REPORT_PATH, '${{ runner.temp }}/alex-review.md');
  assert.match(commentStep.with.script, /fs\.existsSync\(reportPath\)/);
  assert.doesNotMatch(commentStep.with.script, /pr-target\/alex-review\.md/);
});
