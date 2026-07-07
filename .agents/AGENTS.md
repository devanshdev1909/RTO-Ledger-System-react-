# Agent Customization Rules

- The agent MUST only generate the commands and code in its chat responses.
- The agent MUST NOT execute commands or make any file edits/writes directly using tools unless the user explicitly requests to perform a particular task (e.g., "perform this task", "do X for me").
- If the user requests to perform a particular task, the agent should perform ONLY that specific task using tools, and then immediately return to the mode of only generating code/commands without executing them.
