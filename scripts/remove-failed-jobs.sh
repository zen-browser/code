gh_bulk_delete_workflow_runs() {
  repo=$1

  # Ensure the repo argument is provided
  if [[ -z "$repo" ]]; then
    echo "Usage: gh_bulk_delete_workflow_runs <owner/repo>"
    return 1
  fi

  runs=$(gh api repos/$repo/actions/runs --paginate | jq -r '.workflow_runs[] | select(.conclusion == "cancelled" or .conclusion == "failure" or .conclusion == "timed_out") | .id')

  while IFS= read -r run; do
    echo "Deleting run https://github.com/$repo/actions/runs/$run"
    gh api -X DELETE repos/$repo/actions/runs/$run --silent
  done <<< "$runs"

  echo "All workflow runs for $repo have been deleted."
}

gh_bulk_delete_workflow_runs $1
