/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academicYears from "../academicYears.js";
import type * as assessmentQuestions from "../assessmentQuestions.js";
import type * as assessmentWeightingRules from "../assessmentWeightingRules.js";
import type * as assessments from "../assessments.js";
import type * as auth from "../auth.js";
import type * as campus from "../campus.js";
import type * as computedGrades from "../computedGrades.js";
import type * as dashboard from "../dashboard.js";
import type * as discounts from "../discounts.js";
import type * as enrollments from "../enrollments.js";
import type * as feeStructure from "../feeStructure.js";
import type * as feeTransactions from "../feeTransactions.js";
import type * as http from "../http.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as reportCards from "../reportCards.js";
import type * as seed from "../seed.js";
import type * as seedAdmin from "../seedAdmin.js";
import type * as standardLevels from "../standardLevels.js";
import type * as studentAssessmentAnswers from "../studentAssessmentAnswers.js";
import type * as studentDiscounts from "../studentDiscounts.js";
import type * as studentFees from "../studentFees.js";
import type * as students from "../students.js";
import type * as subjects from "../subjects.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academicYears: typeof academicYears;
  assessmentQuestions: typeof assessmentQuestions;
  assessmentWeightingRules: typeof assessmentWeightingRules;
  assessments: typeof assessments;
  auth: typeof auth;
  campus: typeof campus;
  computedGrades: typeof computedGrades;
  dashboard: typeof dashboard;
  discounts: typeof discounts;
  enrollments: typeof enrollments;
  feeStructure: typeof feeStructure;
  feeTransactions: typeof feeTransactions;
  http: typeof http;
  "lib/permissions": typeof lib_permissions;
  reportCards: typeof reportCards;
  seed: typeof seed;
  seedAdmin: typeof seedAdmin;
  standardLevels: typeof standardLevels;
  studentAssessmentAnswers: typeof studentAssessmentAnswers;
  studentDiscounts: typeof studentDiscounts;
  studentFees: typeof studentFees;
  students: typeof students;
  subjects: typeof subjects;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
