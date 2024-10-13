
# Branch Structure

The repository is structured as follows:

```
central (main branch)
  |
  |--- twilight (feature branch)
  |   |
  |-> \-- stable (release branch)
  | |
  | \--- Hotfix (hotfixes directly from stable)
  |
  \--- (features branches)
```

The `central` branch is the main branch of the repository, and it is the default branch for the repository. The `twilight` branch is the feature branch, and it is branched off from the `central` branch. The `stable` branch is the release branch, and it is branched off from the `central` branch. 

The `stable` branch may have hotfixes directly from the `stable` branch, and the `twilight` branch may have feature branches branched off from the `twilight` branch. This is done so that we can apply hotfixes like security patches directly to the `stable` branch without having to merge the changes from the `twilight` branch.

# Code Of Conduct

Please read our [Code of Conduct](../CODE_OF_CONDUCT.md) before contributing.

# Releasing/Merging branches

To merge zen twilight branch from the central branch, you can use the following command:

```bash
sh ./scripts/merge-to-branch.sh twilight
```

To merge zen stable branch from the twilight branch, you can use the following command:

```bash
sh ./scripts/merge-to-branch.sh stable
```
