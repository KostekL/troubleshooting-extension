import { ActionPanel, Action, List, Icon, Form, useNavigation, LocalStorage, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";

// Define a type for our troubleshooting data structure for better type safety
type TroubleshootingStepData = {
  id: string;
  question: string;
  answers: {
    text: string;
    nextId: string | null;
    icon?: keyof typeof Icon;
  }[];
};

type TroubleshootingData = Record<string, TroubleshootingStepData>;


// --------------------------------------------------------------------------------
// INITIAL DATA
// --------------------------------------------------------------------------------
const initialTroubleshootingData: TroubleshootingData = {
  start: {
    id: "start",
    question: "What is the problem with the process?",
    answers: [
      { text: "It's not starting", nextId: "not-starting", icon: "Play" },
      { text: "It's running slow", nextId: "running-slow", icon: "Gauge" },
      { text: "It crashed", nextId: "crashed", icon: "XMarkCircle" },
    ],
  },
  "not-starting": {
    id: "not-starting",
    question: "Have you checked the logs for startup errors?",
    answers: [
      { text: "Yes, there are errors", nextId: "log-errors", icon: "Document" },
      { text: "No, where are the logs?", nextId: "find-logs", icon: "QuestionMark" },
      { text: "There are no logs at all", nextId: "no-logs", icon: "ExclamationMark" },
    ],
  },
  "running-slow": {
    id: "running-slow",
    question: "Is the CPU usage high?",
    answers: [
        { text: "Yes, CPU is at 100%", nextId: "high-cpu", icon: "ComputerChip" },
        { text: "No, CPU is normal", nextId: "normal-cpu", icon: "Leaf" },
    ]
  },
  crashed: {
    id: "crashed",
    question: "Was there a crash report generated?",
    answers: [
        { text: "Yes, I have the report", nextId: "submit-report", icon: "Upload" },
        { text: "No, it just disappeared", nextId: "check-system-logs", icon: "Terminal" },
    ]
  },
  "log-errors": { id: "log-errors", question: "Common errors include 'Permission Denied' or 'Port in Use'.", answers: [{ text: "Solution: Check file permissions or kill the process on that port.", nextId: null, icon: "Wrench" }] },
  "find-logs": { id: "find-logs", question: "Logs are usually in /var/log/ or the application's own directory.", answers: [{ text: "Okay, I'll check there.", nextId: null, icon: "Check" }] },
  "no-logs": { id: "no-logs", question: "This might indicate a problem with file permissions for the log directory.", answers: [{ text: "Solution: Verify the process has write access to its log location.", nextId: null, icon: "Wrench" }]},
  "high-cpu": { id: "high-cpu", question: "This could be an infinite loop or heavy processing.", answers: [{ text: "Solution: Use a profiler to inspect the process.", nextId: null, icon: "Wrench" }] },
  "normal-cpu": { id: "normal-cpu", question: "The bottleneck might be I/O (disk or network).", answers: [{ text: "Solution: Check disk activity and network requests.", nextId: null, icon: "Wrench" }] },
  "submit-report": { id: "submit-report", question: "Please submit the crash report to the development team.", answers: [{ text: "Done!", nextId: null, icon: "Check" }] },
  "check-system-logs": { id: "check-system-logs", question: "Check the main system logs for any related error messages.", answers: [{ text: "Okay, I'll check system logs.", nextId: null, icon: "Check" }] },
};


// --------------------------------------------------------------------------------
// MAIN COMMAND COMPONENT
// --------------------------------------------------------------------------------
export default function Command() {
  const [activeTab, setActiveTab] = useState("flow");
  const [isLoading, setIsLoading] = useState(true);
  const [troubleshootingData, setTroubleshootingData] = useState<TroubleshootingData>({});

  // On initial mount, load the troubleshooting data from LocalStorage.
  useEffect(() => {
    async function loadData() {
      try {
        const storedData = await LocalStorage.getItem("troubleshootingData");
        if (storedData) {
          setTroubleshootingData(JSON.parse(storedData as string));
        } else {
          // If no data is stored, use the initial default data.
          setTroubleshootingData(initialTroubleshootingData);
        }
      } catch (error) {
        console.error("Failed to load or parse troubleshooting data:", error);
        showToast({style: Toast.Style.Failure, title: "Could not load custom flow", message: "Using default flow."});
        setTroubleshootingData(initialTroubleshootingData);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Callback function for the editor to update the main data state.
  const handleSave = useCallback(async (newData: object) => {
    setTroubleshootingData(newData as TroubleshootingData);
    await LocalStorage.setItem("troubleshootingData", JSON.stringify(newData));
    await showToast({style: Toast.Style.Success, title: "Flow Saved!", message: "Your changes have been saved."});
    setActiveTab("flow"); // Switch back to the flow tab after saving
  }, []);

  // A dropdown menu in the search bar to switch between views.
  const searchBarAccessory = (
    <List.Dropdown tooltip="Select View" value={activeTab} onChange={setActiveTab}>
      <List.Dropdown.Item title="Troubleshooting Flow" value="flow" icon={Icon.List} />
      <List.Dropdown.Item title="Edit Flow" value="editor" icon={Icon.Pencil} />
    </List.Dropdown>
  );

  if (activeTab === "editor") {
    return <EditorView currentData={troubleshootingData} onSave={handleSave} />;
  }

  return (
    <FlowView
      isLoading={isLoading}
      troubleshootingData={troubleshootingData}
      searchBarAccessory={searchBarAccessory}
    />
  );
}

// --------------------------------------------------------------------------------
// FLOW VIEW COMPONENT (The troubleshooter itself)
// --------------------------------------------------------------------------------
function FlowView({ isLoading, troubleshootingData, searchBarAccessory }: { isLoading: boolean, troubleshootingData: TroubleshootingData, searchBarAccessory: JSX.Element }) {
  // We start the flow at the 'start' step.
  const startStepId = "start";

  if (!troubleshootingData[startStepId] && !isLoading) {
     return (
      <List searchBarAccessory={searchBarAccessory}>
        <List.EmptyView title="Invalid Flow Data" description="Could not find a 'start' step. Check your data in the editor." icon={Icon.ExclamationMark} />
      </List>
    );
  }
  
  return (
    <TroubleshootingStep
      stepId={startStepId}
      troubleshootingData={troubleshootingData}
      isLoading={isLoading}
      searchBarAccessory={searchBarAccessory}
    />
  );
}

// --------------------------------------------------------------------------------
// EDITOR VIEW COMPONENT (The JSON editor form)
// --------------------------------------------------------------------------------
function EditorView({ currentData, onSave }: { currentData: object, onSave: (data: object) => void }) {
  const { pop } = useNavigation();

  function handleSubmit(values: { jsonData: string }) {
    try {
      const parsedData = JSON.parse(values.jsonData);
      onSave(parsedData);
      pop(); // Go back to the previous view after saving
    } catch (error) {
      console.error("Invalid JSON:", error);
      showToast({style: Toast.Style.Failure, title: "Invalid JSON", message: "Please check your syntax."});
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Flow" onSubmit={handleSubmit} icon={Icon.SaveDocument} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="jsonData"
        title="Troubleshooting JSON"
        placeholder="Enter your troubleshooting flow in JSON format..."
        defaultValue={JSON.stringify(currentData, null, 2)}
      />
    </Form>
  );
}


// --------------------------------------------------------------------------------
// HELPER COMPONENT for rendering each step of the flow
// --------------------------------------------------------------------------------
function TroubleshootingStep({ stepId, troubleshootingData, isLoading, searchBarAccessory }: { stepId: string, troubleshootingData: TroubleshootingData, isLoading: boolean, searchBarAccessory: JSX.Element }) {
  const currentStep = troubleshootingData[stepId];

  if (isLoading) {
    return <List isLoading={true} searchBarAccessory={searchBarAccessory} />;
  }

  if (!currentStep) {
    return (
      <List searchBarAccessory={searchBarAccessory}>
        <List.EmptyView title="End of Flow" description="You've reached a final step." icon={Icon.CheckCircle} />
      </List>
    );
  }

  return (
    <List navigationTitle={currentStep.question} searchBarPlaceholder="Select an answer" searchBarAccessory={searchBarAccessory}>
      {currentStep.answers.map((answer, index) => (
        <List.Item
          key={index}
          title={answer.text}
          icon={answer.icon ? (Icon[answer.icon] || Icon.ChevronRight) : Icon.ChevronRight}
          actions={
            <ActionPanel>
              {answer.nextId ? (
                <Action.Push
                  title="Select"
                  target={
                    <TroubleshootingStep
                      stepId={answer.nextId}
                      troubleshootingData={troubleshootingData}
                      isLoading={false}
                      searchBarAccessory={searchBarAccessory}
                    />
                  }
                />
              ) : (
                <Action.CopyToClipboard
                  title="Copy Solution to Clipboard"
                  content={answer.text.replace(/^Solution: /, "")}
                />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
