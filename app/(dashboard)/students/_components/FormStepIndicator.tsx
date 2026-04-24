import { cn } from "@/lib/utils";

const steps = [
  { number: 1, title: "Student Info" },
  { number: 2, title: "Family Info" },
  { number: 3, title: "Fees" },
];

export function FormStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex gap-2 mb-4">
      {steps.map((step) => {
        const isActive = step.number === currentStep;
        const isDone = step.number < currentStep;
        return (
          <div
            key={step.number}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors",
              isDone
                ? "bg-green-50 text-green-800 font-medium"
                : isActive
                  ? "bg-white border-[1.5px] border-school-green text-school-green font-semibold"
                  : "bg-slate-100 text-slate-400",
            )}
          >
            {isDone ? (
              <span>&#10003;</span>
            ) : (
              <span className="text-[10px]">{step.number}.</span>
            )}
            {step.title}
          </div>
        );
      })}
    </div>
  );
}
