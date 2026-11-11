"use client";

import type { ComponentType } from "react";
import {
  FamilyAttendance,
  FamilyExams,
  FamilyFees,
  FamilyHome,
  FamilyHomework,
  FamilyResults,
  FamilyTimetable,
  ParentCertificates,
  ParentPtm,
} from "./family/screens";
import { PlatformHome, PlatformStatus, SchoolHome } from "./school/dashboards";
import { CertificateNew, CertificateVerify, NoticeNew } from "./school/forms";
import {
  ApprovalInbox,
  AttendanceOverview,
  CalendarScreen,
  FeeLedger,
  FeesOverview,
  Reports,
  ResultsOverview,
  StudentDetail,
} from "./school/operations";
import { env } from "@/config/env";
import { FeeStructure } from "./school/fee-structure";
import { OpeningBalances } from "./school/opening-balances";
import { PaymentDetails } from "./school/payment-details";
import { PaymentProofs } from "./school/payment-proofs";
import { Refunds } from "./school/refunds";
import { Rollover } from "./school/rollover";
import { Settings } from "./school/settings";
import { ResourceTableScreen, TABLES } from "./shared/resource-table";
import type { ScreenProps } from "./shared/planned-screen";
import { AttendanceClass, AttendancePick } from "./teacher/attendance";
import { HomeworkList, HomeworkNew } from "./teacher/homework";
import { MarksClass, MarksPick } from "./teacher/marks";
import { LeavePage, Syllabus, TeacherClasses, TeacherToday } from "./teacher/misc";
import { TeacherHome } from "./teacher/teacher-home";

type C = ComponentType<ScreenProps>;
const plain = (Comp: ComponentType): C =>
  function Wrapped() {
    return <Comp />;
  };

/**
 * screen id (config/screens.ts) → component. Screens with status "planned" have no entry and render
 * <PlannedScreen/>. List-style screens are configured in shared/resource-table.tsx (TABLES).
 */
export const SCREEN_COMPONENTS: Record<string, C> = {
  ...Object.fromEntries(Object.keys(TABLES).map((id) => [id, ResourceTableScreen as C])),

  "platform-home": plain(PlatformHome),
  "platform-status": plain(PlatformStatus),

  "school-home": plain(SchoolHome),
  "school-approvals": plain(ApprovalInbox),
  "school-calendar": CalendarScreen,
  "school-student-detail": StudentDetail,
  "school-attendance": plain(AttendanceOverview),
  "school-results": plain(ResultsOverview),
  "school-fees": plain(FeesOverview),
  "school-fee-ledger": plain(FeeLedger),
  "school-refunds": plain(Refunds),
  "school-payment-details": plain(PaymentDetails),
  "school-opening-balances": plain(OpeningBalances),
  // Real fee heads and "raise a fee" with the live backend; the sample-data table otherwise.
  "school-fee-structure":
    env.dataSource === "api" ? plain(FeeStructure) : (ResourceTableScreen as C),
  "school-payment-proofs": plain(PaymentProofs),
  "school-notice-new": plain(NoticeNew),
  "school-certificate-new": plain(CertificateNew),
  "school-certificate-verify": plain(CertificateVerify),
  "school-rollover": plain(Rollover),
  "school-reports": plain(Reports),
  "school-settings": plain(Settings),

  "teacher-home": plain(TeacherHome),
  "teacher-today": plain(TeacherToday),
  "teacher-classes": plain(TeacherClasses),
  "teacher-attendance": plain(AttendancePick),
  "teacher-attendance-class": AttendanceClass,
  "teacher-homework": plain(HomeworkList),
  "teacher-homework-new": plain(HomeworkNew),
  "teacher-marks": plain(MarksPick),
  "teacher-marks-class": MarksClass,
  "teacher-syllabus": plain(Syllabus),
  "teacher-leave": plain(LeavePage),

  "parent-home": plain(FamilyHome),
  "parent-attendance": plain(FamilyAttendance),
  "parent-homework": plain(FamilyHomework),
  "parent-results": plain(FamilyResults),
  "parent-fees": plain(FamilyFees),
  "parent-calendar": CalendarScreen,
  "parent-timetable": plain(FamilyTimetable),
  "parent-ptm": plain(ParentPtm),
  "parent-certificates": plain(ParentCertificates),

  "student-home": plain(FamilyHome),
  "student-timetable": plain(FamilyTimetable),
  "student-homework": plain(FamilyHomework),
  "student-exams": plain(FamilyExams),
  "student-results": plain(FamilyResults),
  "student-attendance": plain(FamilyAttendance),
  "student-calendar": CalendarScreen,
};
