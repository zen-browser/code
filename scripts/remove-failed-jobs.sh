#!/bin/bash

gh_bulk_delete_workflow_runs() {
  local repo=$1

  # Ensure the repo argument is provided
  if [[ -z "$repo" ]]; then
    echo "Usage: gh_bulk_delete_workflow_runs <owner/repo>"
    return 1
  fi

  # Fetch workflow runs that are cancelled, failed, or timed out
  local runs
  runs=$(gh api repos/$repo/actions/runs --paginate \
    | jq -r '.workflow_runs[] | 
    select(.conclusion == "cancelled" or 
      .conclusion == "failure" or 
      .conclusion == "timed_out") | 
    .id')

  if [[ -z "$runs" ]]; then
    echo "No workflow runs found for $repo with the specified conclusions."
    return 0
  fi

  # Loop through each run and delete it
  while IFS= read -r run; do
    echo "Attempting to delete run: https://github.com/$repo/actions/runs/$run"

    # Perform the deletion
    if gh api -X DELETE repos/$repo/actions/runs/$run --silent; then
      echo "Successfully deleted run: $run"
    else
      echo "Error deleting run: $run" >&2
    fi

    # Optional delay to avoid hitting API rate limits
    sleep 1
  done <<< "$runs"

  echo "Completed deletion process for workflow runs in $repo."
}

# Execute the function with the provided argument
gh_bulk_delete_workflow_runs "$1"
