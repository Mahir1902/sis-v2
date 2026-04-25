"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useStudentAdmission } from "@/hooks/useStudentAdmission";
import { familyInfoSchema } from "@/lib/validations/familyInfoSchema";
import { feesSchema } from "@/lib/validations/feesSchema";
import { studentInfoBaseSchema } from "@/lib/validations/studentInfoSchema";
import { FormStepIndicator } from "./FormStepIndicator";
import { FamilyInfoStep } from "./steps/FamilyInfoStep";
import { FeesStep } from "./steps/FeesStep";
import { StudentInfoStep } from "./steps/StudentInfoStep";

// Combined schema for full form — use merge (ZodObject) then add refine
const admissionSchema = studentInfoBaseSchema
  .merge(familyInfoSchema)
  .merge(feesSchema)
  .refine(
    (data) =>
      !data.hasHealthIssues ||
      (data.healthIssueDescription &&
        data.healthIssueDescription.trim().length > 0),
    {
      message: "Please describe the health issue",
      path: ["healthIssueDescription"],
    },
  );
type AdmissionValues = z.infer<typeof admissionSchema>;

const stepBaseSchemas = [studentInfoBaseSchema, familyInfoSchema, feesSchema];

interface AddStudentFormProps {
  onSuccess: () => void;
}

export function AddStudentForm({ onSuccess }: AddStudentFormProps) {
  const [step, setStep] = useState(1);
  const { submitAdmission, isSubmitting } = useStudentAdmission(onSuccess);

  const form = useForm<AdmissionValues>({
    resolver: zodResolver(admissionSchema),
    defaultValues: {
      gender: undefined,
      hasHealthIssues: false,
      siblings: [],
    },
    mode: "onChange",
  });

  async function handleNext() {
    const currentBaseSchema = stepBaseSchemas[step - 1];
    const fields = Object.keys(currentBaseSchema.shape ?? {});
    const valid = await form.trigger(fields as (keyof AdmissionValues)[]);
    if (valid) setStep((s) => s + 1);
  }

  async function onSubmit(values: AdmissionValues) {
    await submitAdmission(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormStepIndicator currentStep={step} />

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {step === 1 && <StudentInfoStep />}
          {step === 2 && <FamilyInfoStep />}
          {step === 3 && <FeesStep />}
        </div>

        <div className="flex justify-between pt-4 border-t">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-school-green hover:bg-school-green/90 text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-school-green hover:bg-school-green/90 text-white"
            >
              {isSubmitting ? "Submitting…" : "Complete Admission"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
