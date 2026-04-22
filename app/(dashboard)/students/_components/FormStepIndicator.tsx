import { cn } from "@/lib/utils";

const steps = [
  { number: 1, title: "Student Information", description: "Personal & academic details" },
  { number: 2, title: "Family & Financials", description: "Guardian & income information" },
  { number: 3, title: "Fees & Finalization", description: "Fee assignment & confirmation" },
];

export function FormStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex gap-2 mb-6">
      {steps.map((step) => {
        const isActive = step.number === currentStep;
        const isDone = step.number < currentStep;
        return (
          <div
            key={step.number}
            className={cn(
              "flex-1 border-t-4 pt-3 px-1",
              isActive
                ? "border-school-yellow"
                : isDone
                ? "border-school-green"
                : "border-gray-200"
            )}
          >
            <p
              className={cn(
                "text-xs font-bold",
                isActive ? "text-school-yellow" : isDone ? "text-school-green" : "text-gray-400"
              )}
            >
              Step {step.number}
            </p>
            <p className={cn("text-sm font-semibold mt-0.5", isActive ? "text-gray-900" : "text-gray-500")}>
              {step.title}
            </p>
            <p className="text-xs text-gray-400">{step.description}</p>
          </div>
        );
      })}
    </div>
  );
}
