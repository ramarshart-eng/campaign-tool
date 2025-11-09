name: Epic
about: Track a larger body of work with acceptance criteria and tasks
title: "Epic: <short title>"
labels: [epic]
assignees: []

body:
  - type: textarea
    id: context
    attributes:
      label: Context
      description: Why this matters and user impact
      placeholder: Short context
    validations:
      required: false
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: Bullet list of outcomes that must be true
      placeholder: "- [ ] ..."
    validations:
      required: true
  - type: textarea
    id: tasks
    attributes:
      label: Tasks
      description: Checklist of tasks or links to PRs
      placeholder: "- [ ] ..."
    validations:
      required: false
