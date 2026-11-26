import { BRAND, type InfoSlug } from "@/lib/site";

export interface InfoPage {
  intro: string;
  /** Shown on legal pages until someone qualified has approved the wording. */
  draft?: boolean;
  sections: { title: string; body: string[] }[];
}

export const INFO_PAGES: Record<InfoSlug, InfoPage> = {
  guides: {
    intro: "Short guides for the first days on the product.",
    sections: [
      {
        title: "School owner and principal",
        body: [
          "Sign in on your school's staff address with the e-mail the ZAQSA team set up.",
          "Add classes and subjects, then add staff. Open a staff member to create their login.",
          "Add students with their parent's details, then create the parent login from the student.",
        ],
      },
      {
        title: "Teachers",
        body: [
          "Home shows today's periods and what is still to do.",
          "Mark attendance for a class, save a draft, or submit it.",
          "Share homework, study material and lesson plans, and enter exam marks.",
        ],
      },
      {
        title: "Parents and students",
        body: [
          "Open the invite e-mail and choose a password. The link works for 48 hours.",
          "Sign in on your school's parent address to see attendance, homework, results and fees.",
        ],
      },
    ],
  },
  faq: {
    intro: "Answers to the questions we hear most.",
    sections: [
      {
        title: "How does a school join?",
        body: ["Send a request from the Get started page. The ZAQSA team sets the school up."],
      },
      {
        title: "I did not get my invite e-mail.",
        body: [
          "Check the spam folder, then ask the school office to resend the invite. You can also use “Forgot your password?” on the sign-in page.",
        ],
      },
      {
        title: "Which address do I sign in on?",
        body: [
          "Staff use the school's staff address. Parents and students use the school's parent address. The school can tell you both.",
        ],
      },
      {
        title: "Can one school see another school's records?",
        body: [
          "No. Each school's records are kept separate and a sign-in only opens its own school.",
        ],
      },
    ],
  },
  help: {
    intro: "Where to start when something is not working.",
    sections: [
      {
        title: "Sign-in problems",
        body: [
          "Make sure you are on your school's own address.",
          "Use “Forgot your password?” to get a new link.",
          "If the school is still being set up, families can sign in once it goes live.",
        ],
      },
      {
        title: "Wrong or missing records",
        body: ["Ask your school office. Only the school can correct its records."],
      },
      {
        title: "School staff",
        body: ["Owners and principals can raise a support request with the ZAQSA team."],
      },
    ],
  },
  contact: {
    intro: "Talk to the right people.",
    sections: [
      {
        title: "Schools that want to join",
        body: ["Use the Get started page or the demo form on the home page. The team will reply."],
      },
      {
        title: "Parents, students and staff",
        body: ["Contact your school office. They manage logins and records."],
      },
    ],
  },
  privacy: {
    draft: true,
    intro: `How ${BRAND} handles personal information.`,
    sections: [
      {
        title: "What is kept",
        body: [
          "Records a school enters to run itself: student, parent and staff details, attendance, marks, fees and messages.",
          "Details you send in a demo or sign-up request.",
        ],
      },
      {
        title: "Who can see it",
        body: [
          "People at the same school, limited by their role. Parents see only their own children.",
          "The ZAQSA team, where needed to run and support the service.",
        ],
      },
      {
        title: "Cookies",
        body: ["A sign-in cookie keeps you signed in. It is needed for the product to work."],
      },
      {
        title: "Your requests",
        body: ["To correct or remove a record, ask your school, which decides what it keeps."],
      },
    ],
  },
  terms: {
    draft: true,
    intro: `The rules for using ${BRAND}.`,
    sections: [
      {
        title: "Accounts",
        body: [
          "Keep your password to yourself. Tell your school if someone else may have used your account.",
        ],
      },
      {
        title: "Acceptable use",
        body: [
          "Use the product only for school work. Do not try to reach records you are not allowed to see.",
        ],
      },
      {
        title: "School records",
        body: ["Each school is responsible for the accuracy of what it enters."],
      },
      {
        title: "Plans",
        body: [
          "A school's plan sets its limits. When a plan lapses, records can still be read and exported.",
        ],
      },
    ],
  },
};
