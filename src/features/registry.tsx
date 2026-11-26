"use client";

import { PlatformFeatures } from "./platform/features";
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
import { AskSchool } from "./family/ask-school";
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
import { LiveRollover } from "./school/live-rollover";
import { StaffAchievements } from "./school/achievements";
import { PlatformConfig } from "./platform/config";
import {
  FamilyAchievements,
  FamilyMaterials,
  ParentDocuments,
  ParentMessages,
  ParentProfile,
} from "./family/extras";
import { TeacherLessons, TeacherMaterials, TeacherMessages } from "./teacher/classwork";
import { Curriculum } from "./school/curriculum";
import { LiveReports, LiveResults } from "./school/live-reports";
import { PtmAdmin } from "./school/ptm-admin";
import { LiveSyllabus } from "./teacher/live-syllabus";
import { Settings } from "./school/settings";
import { SchoolTimetable } from "./school/timetable";
import { ResourceTableScreen, TABLES } from "./shared/resource-table";
import type { ScreenProps } from "./shared/planned-screen";
import { AttendanceClass, AttendancePick } from "./teacher/attendance";
import { HomeworkList, HomeworkNew } from "./teacher/homework";
import { MarksClass, MarksPick } from "./teacher/marks";
import { RegisterHub, RegisterPage } from "./shared/registers";
import { CoverPage, StaffAttendancePage, TeacherCovers } from "./school/staff-day";
import { EarlyWarning, ReportBuilder } from "./school/insights";
import { MyPayslips, PayrollPage } from "./school/payroll";
import { SeatingPage } from "./school/seating";
import { StockPage } from "./school/stock";
import { FamilyAnswers, FamilyQuizzes } from "./family/learning";
import { TeacherQuizzes, TeacherSubmissions } from "./teacher/learning";
import { PollsPage } from "./shared/community";
import { StudentFiles } from "./shared/files";
import { PrintCentre, PrintScreen } from "./shared/print";
import { LeavePage, Syllabus, TeacherClasses, TeacherToday } from "./teacher/misc";
import { TeacherHome } from "./teacher/teacher-home";

type C = ComponentType<ScreenProps>;
const plain = (Comp: ComponentType): C =>
  function Wrapped() {
    return <Comp />;
  };

/**
 * screen id (config/screens.ts) → component. A screen with no entry renders
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
  "school-results": plain(env.dataSource === "api" ? LiveResults : ResultsOverview),
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
  "school-rollover": plain(env.dataSource === "api" ? LiveRollover : Rollover),
  "school-achievements": plain(StaffAchievements),
  "platform-config": plain(PlatformConfig),
  "platform-features": plain(PlatformFeatures),
  "teacher-materials": plain(TeacherMaterials),
  "teacher-lessons": plain(TeacherLessons),
  "teacher-messages": plain(TeacherMessages),
  "teacher-achievements": plain(StaffAchievements),
  "parent-documents": plain(ParentDocuments),
  "parent-messages": plain(ParentMessages),
  "parent-achievements": plain(FamilyAchievements),
  "parent-profile": plain(ParentProfile),
  "student-materials": plain(FamilyMaterials),
  "student-achievements": plain(FamilyAchievements),
  "school-reports": plain(env.dataSource === "api" ? LiveReports : Reports),
  "school-curriculum": plain(Curriculum),
  "school-timetable": plain(SchoolTimetable),
  "school-settings": plain(Settings),
  "school-ptm": plain(PtmAdmin),

  "teacher-home": plain(TeacherHome),
  "teacher-today": plain(TeacherToday),
  "teacher-classes": plain(TeacherClasses),
  "teacher-attendance": plain(AttendancePick),
  "teacher-attendance-class": AttendanceClass,
  "teacher-homework": plain(HomeworkList),
  "teacher-homework-new": plain(HomeworkNew),
  "teacher-marks": plain(MarksPick),
  "teacher-marks-class": MarksClass,
  "teacher-syllabus": plain(env.dataSource === "api" ? LiveSyllabus : Syllabus),
  "teacher-leave": plain(LeavePage),

  "parent-home": plain(FamilyHome),
  "parent-attendance": plain(FamilyAttendance),
  "parent-homework": plain(FamilyHomework),
  "parent-results": plain(FamilyResults),
  "parent-fees": plain(FamilyFees),
  "parent-calendar": CalendarScreen,
  "parent-timetable": plain(FamilyTimetable),
  "parent-ptm": plain(ParentPtm),
  "parent-queries": plain(AskSchool),
  "parent-certificates": plain(ParentCertificates),

  "student-home": plain(FamilyHome),
  "student-timetable": plain(FamilyTimetable),
  "student-homework": plain(FamilyHomework),
  "student-exams": plain(FamilyExams),
  "student-results": plain(FamilyResults),
  "student-attendance": plain(FamilyAttendance),
  "student-calendar": CalendarScreen,
  "school-staff-attendance": plain(StaffAttendancePage),
  "school-cover": plain(CoverPage),
  "school-student-files": plain(StudentFiles),
  "school-stock": plain(StockPage),
  "school-payroll": plain(PayrollPage),
  "school-payslips": plain(MyPayslips),
  "school-seating": plain(SeatingPage),
  "school-report-builder": plain(ReportBuilder),
  "school-early-warning": plain(EarlyWarning),
  "school-polls": plain(PollsPage),
  "school-print-centre": plain(PrintCentre),
  "school-print": PrintScreen,
  "teacher-covers": plain(TeacherCovers),
  "teacher-submissions": plain(TeacherSubmissions),
  "teacher-quizzes": plain(TeacherQuizzes),
  "teacher-polls": plain(PollsPage),
  "teacher-payslips": plain(MyPayslips),
  "teacher-print": PrintScreen,
  "parent-answers": plain(FamilyAnswers),
  "parent-quizzes": plain(FamilyQuizzes),
  "parent-polls": plain(PollsPage),
  "parent-print": PrintScreen,
  "student-answers": plain(FamilyAnswers),
  "student-quizzes": plain(FamilyQuizzes),
  "student-polls": plain(PollsPage),
  ...Object.fromEntries(
    ["school", "teacher", "parent", "student"].flatMap((a) => [
      [`${a}-records`, plain(RegisterHub)],
      [`${a}-record`, RegisterPage as C],
    ]),
  ),
};
