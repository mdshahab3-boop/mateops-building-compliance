/**
 * Seeds a demo tenant (T&M Management Services) with the real 101–121 Castlereagh
 * content as three published inductions, an admin login, and shareable enrol
 * links. Idempotent: it deletes and recreates the demo org each run.
 *
 * Run:  DATABASE_ADMIN_URL=... pnpm --filter @scip/web seed
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { withAdmin, closePools } from "@scip/db";
import { hashPassword } from "@scip/auth";

config({ path: ".env.local" });
config();

const token = () => randomBytes(9).toString("base64url");

interface Slide {
  title: string;
  body: string;
  narration: string;
}
interface Question {
  prompt: string;
  options: { label: string; correct?: boolean }[];
}
interface InductionSeed {
  title: string;
  contentType: string;
  declaration: string;
  slides: Slide[];
  questions: Question[];
}

const ADMIN_EMAIL = "admin@tmmanagementservices.com.au";
const ADMIN_PASSWORD = "TMdemo2026!";

const declaration =
  "I confirm that I have watched and understood this induction for 101–121 " +
  "Castlereagh Street, that the details I have provided are true, and that I " +
  "agree to comply with the site rules, procedures and directions of Shared " +
  "Facilities Management at all times while on site.";

const inductions: InductionSeed[] = [
  {
    title: "Shared Facilities Site Induction",
    contentType: "site_induction",
    declaration,
    slides: [
      {
        title: "Welcome to 101–121 Castlereagh Street",
        body: "This is a mixed-use development with residential, retail and commercial components, managed under Shared Facilities Management by T&M Management Services. These rules keep everyone safe and keep the building trading.",
        narration:
          "Welcome. Before you work on site at 101 to 121 Castlereagh Street you must complete this induction. It only takes a few minutes.",
      },
      {
        title: "Approved working hours & sign-in",
        body: "Shared Services works Mon–Fri 8:00am–4:00pm. All contractors must sign in via the PMS tablet at the Level B1 Loading Dock Office. Master keys are only issued once your induction is complete and final approval is given.",
        narration:
          "Always sign in at the B one loading dock office before starting. You must be inducted and approved before keys or access are issued.",
      },
      {
        title: "WHS & Safe Work Method Statements",
        body: "Under the WHS Act, everyone must maintain a safe workplace. Before any works you must provide a risk assessment and a task- and site-specific SWMS, plus a WHS plan. Works cannot start until these are approved.",
        narration:
          "You are responsible for working safely. Provide your S W M S and W H S plan and wait for approval before starting any work.",
      },
      {
        title: "Hot works & fire safety",
        body: "Any hot works (welding, brazing, grinding) require an approved Hot Works Permit. A fire watch must be kept for 60 minutes after work stops. Building fire extinguishers must NOT be used for hot works — bring your own. Only SFM may authorise isolating fire systems.",
        narration:
          "Hot works need a permit and a sixty minute fire watch. Never isolate a fire system without Shared Facilities Management approval.",
      },
      {
        title: "Electrical safety & isolations",
        body: "No work on live installations except commissioning/testing with a written SWMS. Use fibreglass ladders only near electrical work. All leads and tools must be tested and tagged (AS/NZS 3760). Isolations use Lock Out / Tag Out — tie-wire or tape is not acceptable.",
        narration:
          "Only work de-energised. Test and tag your equipment, use insulated ladders, and always lock out and tag out isolations.",
      },
      {
        title: "Incident reporting & behaviour",
        body: "Report any safety, security or maintenance issue to Shared Facilities Management immediately. Unsafe, unlawful or disruptive behaviour, or accessing unauthorised areas, means removal from site and revocation of your induction.",
        narration:
          "Report incidents straight away. Unsafe or unauthorised behaviour will have you removed from site.",
      },
    ],
    questions: [
      {
        prompt: "Where must all contractors sign in before starting work?",
        options: [
          { label: "The PMS tablet at the Level B1 Loading Dock Office", correct: true },
          { label: "Anywhere on the ground floor" },
          { label: "Signing in is not required" },
        ],
      },
      {
        prompt: "After hot works finish, how long must a fire watch be maintained?",
        options: [
          { label: "No fire watch is needed" },
          { label: "60 minutes", correct: true },
          { label: "5 minutes" },
        ],
      },
      {
        prompt: "What must you supply and have approved before commencing works?",
        options: [
          { label: "Nothing — just start" },
          { label: "Only a business card" },
          { label: "A risk assessment and a site- and task-specific SWMS", correct: true },
        ],
      },
    ],
  },
  {
    title: "Shared Facilities House Rules",
    contentType: "house_rules",
    declaration,
    slides: [
      {
        title: "About the building",
        body: "101–121 Castlereagh Street integrates a Residential Tower, a Commercial Tower and a Retail precinct with shared areas and services. The House Rules must be read with the Strata Management Statement (SMS), which takes precedence in any conflict.",
        narration:
          "These House Rules apply to everyone working in the shared facilities and must be read together with the Strata Management Statement.",
      },
      {
        title: "Operating & loading dock hours",
        body: "Onsite management office: 8:00am–4:00pm Mon–Fri. Loading dock: 6:00am–6:00pm Mon–Fri (Marcus Clarence, Loading Dock Manager). After-hours and emergencies: 0401 344 687.",
        narration:
          "Know the operating hours. The loading dock runs six a m to six p m weekdays, and there is a twenty four hour emergency contact.",
      },
      {
        title: "Deliveries, trolleys & the goods lift",
        body: "All deliveries and larger items move through the shared goods lift and designated routes — not through residential or retail lobbies. Keep areas clean after deliveries. Book the dock and shared goods lift in advance.",
        narration:
          "Use the loading dock and goods lift for deliveries, book in advance, and leave shared areas clean.",
      },
      {
        title: "Parking & access cards",
        body: "There is no onsite parking for contractors — use nearby commercial car parks. Access to shared service risers and restricted areas needs prior approval; representatives must provide contractors with the necessary access cards.",
        narration:
          "There is no contractor parking on site. Riser and restricted access must be approved in advance.",
      },
      {
        title: "A clean, safe, respectful site",
        body: "101–121 Castlereagh Street is a non-smoking, non-vaping environment. No alcohol or drugs. Manage your waste and keep noise within approved hours to avoid disturbing residents, retail and commercial tenants.",
        narration:
          "This is a smoke free, drug and alcohol free site. Keep it clean and respect residents and tenants.",
      },
    ],
    questions: [
      {
        prompt: "What are the loading dock operating hours (Mon–Fri)?",
        options: [
          { label: "24 hours" },
          { label: "6:00am – 6:00pm", correct: true },
          { label: "9:00am – 5:00pm" },
        ],
      },
      {
        prompt: "Which document takes precedence over the House Rules if they conflict?",
        options: [
          { label: "The Strata Management Statement (SMS)", correct: true },
          { label: "The contractor's own policy" },
          { label: "Nothing takes precedence" },
        ],
      },
      {
        prompt: "Is smoking or vaping permitted on site?",
        options: [
          { label: "Yes, anywhere" },
          { label: "Only in the loading dock" },
          { label: "No — it is a non-smoking, non-vaping environment", correct: true },
        ],
      },
    ],
  },
  {
    title: "Traffic Management Plan",
    contentType: "traffic_management",
    declaration,
    slides: [
      {
        title: "Purpose of the Traffic Management Plan",
        body: "This TMP sets a safe, consistent framework for moving vehicles and pedestrians in and around 101–121 Castlereagh Street. It aims to provide safe access and egress, protect pedestrians and cyclists, keep traffic flowing, and keep emergency access clear.",
        narration:
          "The Traffic Management Plan keeps vehicles, cyclists and pedestrians safe around the site. Read it before driving on site.",
      },
      {
        title: "Vehicle access — Castlereagh Street only",
        body: "Vehicle entry and exit is permitted ONLY via Castlereagh Street, which is one-way southbound. All movements must be in a forward direction — reversing into or out of the site is strictly prohibited. On exit, turn right onto Castlereagh Street.",
        narration:
          "Enter and exit only from Castlereagh Street, always driving forward. Reversing in or out of the site is not allowed.",
      },
      {
        title: "Speed limits & pedestrian priority",
        body: "A 5 km/h speed limit applies within the site, including the loading dock and driveways. Castlereagh Street itself is 40 km/h with a dual bicycle lane. Pedestrians and cyclists always have priority — stop and give way to anyone approaching from either direction.",
        narration:
          "Five kilometres an hour on site. Always stop and give way to pedestrians and cyclists.",
      },
      {
        title: "Car hoist & Automated Vehicle Parking (AVPS)",
        body: "Registered vehicles use the vehicle hoist; pause for the number-plate recognition (ANPR) system before entering. The AVPS in Basement 2 stores and retrieves vehicles automatically — follow all displayed instructions and never enter unless directed.",
        narration:
          "Wait for number plate recognition at the hoist. The automated parking system moves vehicles for you — follow the displayed instructions.",
      },
      {
        title: "Loading dock & height limits",
        body: "The Basement Level 1 loading dock operates 6:00am–6:00pm Mon–Fri, 9:00am–5:00pm Sat. Height-clearance bars are installed at entrances — check your vehicle height. Work outside these hours needs prior written approval and a risk assessment.",
        narration:
          "Mind the height clearance bars and stick to the loading dock hours. Out of hours work must be approved in advance.",
      },
    ],
    questions: [
      {
        prompt: "How may vehicles move into and out of the site?",
        options: [
          { label: "In forward direction only — reversing is prohibited", correct: true },
          { label: "Reversing is fine if you're careful" },
          { label: "Any direction, any street" },
        ],
      },
      {
        prompt: "What is the speed limit within the site (loading dock and driveways)?",
        options: [
          { label: "40 km/h" },
          { label: "5 km/h", correct: true },
          { label: "There is no limit on site" },
        ],
      },
      {
        prompt: "Who has priority when moving around the site?",
        options: [
          { label: "Vehicles always" },
          { label: "Pedestrians and cyclists", correct: true },
          { label: "Whoever arrives first" },
        ],
      },
    ],
  },
];

async function main() {
  await withAdmin(async (c) => {
    console.log("Resetting demo org…");
    await c.query("delete from organisations where slug = 'tmms'");

    const org = (
      await c.query<{ id: string }>(
        "insert into organisations(name, slug, abn, brand) values ($1,$2,$3,$4) returning id",
        [
          "T&M Management Services",
          "tmms",
          "",
          JSON.stringify({ teal: "#0f7b7b", orange: "#e8622a" }),
        ],
      )
    ).rows[0]!.id;

    const proPlan = (
      await c.query<{ id: string }>("select id from plans where code='pro'")
    ).rows[0]!.id;
    await c.query(
      "insert into subscriptions(organisation_id, plan_id, status, current_period_start, current_period_end) values ($1,$2,'active', now(), now() + interval '1 year')",
      [org, proPlan],
    );

    const property = (
      await c.query<{ id: string }>(
        `insert into properties(organisation_id, name, address_line1, suburb, state, postcode)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [org, "101–121 Castlereagh Street", "101–121 Castlereagh Street", "Sydney", "NSW", "2000"],
      )
    ).rows[0]!.id;

    await c.query(
      "insert into locations(organisation_id, property_id, name, description) values ($1,$2,$3,$4)",
      [org, property, "B1 Loading Dock", "Level B1 loading dock & sign-in office"],
    );

    // Admin user
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const admin = (
      await c.query<{ id: string }>(
        `insert into users(organisation_id, email, password_hash, full_name, status)
         values ($1,$2,$3,$4,'active') returning id`,
        [org, ADMIN_EMAIL, passwordHash, "Daniel Howe"],
      )
    ).rows[0]!.id;
    const orgAdminRole = (
      await c.query<{ id: string }>("select id from roles where code='org_admin'")
    ).rows[0]!.id;
    await c.query(
      "insert into user_roles(organisation_id, user_id, role_id) values ($1,$2,$3)",
      [org, admin, orgAdminRole],
    );

    const links: { title: string; url: string }[] = [];

    for (const ind of inductions) {
      const inductionId = (
        await c.query<{ id: string }>(
          `insert into inductions(organisation_id, property_id, title, content_type, is_mandatory)
           values ($1,$2,$3,$4,true) returning id`,
          [org, property, ind.title, ind.contentType],
        )
      ).rows[0]!.id;

      const versionId = (
        await c.query<{ id: string }>(
          `insert into induction_versions
             (organisation_id, induction_id, version_number, status, effective_from,
              expires_after_days, pass_score, declaration_text, published_by, published_at, content_hash)
           values ($1,$2,1,'published', now(), 365, 67, $3, $4, now(), $5) returning id`,
          [org, inductionId, ind.declaration, admin, token()],
        )
      ).rows[0]!.id;

      let order = 0;
      for (const s of ind.slides) {
        await c.query(
          `insert into induction_slides
             (organisation_id, induction_version_id, sort_order, title, body, narration, reviewer_status)
           values ($1,$2,$3,$4,$5,$6,'approved')`,
          [org, versionId, order++, s.title, s.body, s.narration],
        );
      }

      let qOrder = 0;
      for (const q of ind.questions) {
        const questionId = (
          await c.query<{ id: string }>(
            `insert into induction_questions
               (organisation_id, induction_version_id, prompt, question_type, sort_order)
             values ($1,$2,$3,'single_choice',$4) returning id`,
            [org, versionId, q.prompt, qOrder++],
          )
        ).rows[0]!.id;
        let oOrder = 0;
        for (const o of q.options) {
          await c.query(
            `insert into induction_question_options
               (organisation_id, question_id, label, is_correct, sort_order)
             values ($1,$2,$3,$4,$5)`,
            [org, questionId, o.label, o.correct ?? false, oOrder++],
          );
        }
      }

      const enrol = token();
      await c.query(
        `insert into qr_codes(organisation_id, property_id, induction_id, token, purpose)
         values ($1,$2,$3,$4,'enrol')`,
        [org, property, inductionId, enrol],
      );
      links.push({ title: ind.title, url: `/i/${enrol}` });
    }

    // One sample completed record so the dashboard shows real compliance data.
    const site = (
      await c.query<{ version_id: string; declaration_text: string | null; induction_id: string }>(
        `select v.id as version_id, v.declaration_text, i.id as induction_id
         from induction_versions v
         join inductions i on i.id = v.induction_id
         where i.organisation_id = $1 and i.content_type = 'site_induction' and v.status = 'published'
         order by v.version_number desc limit 1`,
        [org],
      )
    ).rows[0];
    if (site) {
      const compId = (
        await c.query<{ id: string }>(
          "insert into contractor_companies(organisation_id, name) values ($1,$2) returning id",
          [org, "Rivera Electrical Pty Ltd"],
        )
      ).rows[0]!.id;
      const ctId = (
        await c.query<{ id: string }>(
          "insert into contractors(organisation_id, contractor_company_id, full_name, phone) values ($1,$2,$3,$4) returning id",
          [org, compId, "Sam Rivera", "0412 345 678"],
        )
      ).rows[0]!.id;
      const vtoken = token();
      const attemptId = (
        await c.query<{ id: string }>(
          `insert into induction_attempts
             (organisation_id, property_id, contractor_id, induction_version_id, status, score, passed,
              completed_at, verification_token, started_at, progress)
           values ($1,$2,$3,$4,'passed',100,true, now() - interval '2 days', $5, now() - interval '2 days','{}'::jsonb)
           returning id`,
          [org, property, ctId, site.version_id, vtoken],
        )
      ).rows[0]!.id;
      await c.query(
        "insert into declarations(organisation_id, attempt_id, declaration_text, induction_version_id) values ($1,$2,$3,$4)",
        [org, attemptId, site.declaration_text ?? "", site.version_id],
      );
      await c.query(
        "insert into signatures(organisation_id, attempt_id, signed_name) values ($1,$2,$3)",
        [org, attemptId, "Sam Rivera"],
      );
      const certNo = "TM-CS-" + randomBytes(4).toString("hex").toUpperCase();
      const certId = (
        await c.query<{ id: string }>(
          `insert into certificates
             (organisation_id, property_id, contractor_id, induction_version_id, attempt_id, certificate_number, valid_until)
           values ($1,$2,$3,$4,$5,$6, now() + interval '363 days') returning id`,
          [org, property, ctId, site.version_id, attemptId, certNo],
        )
      ).rows[0]!.id;
      await c.query(
        `insert into compliance_records
           (organisation_id, property_id, contractor_id, induction_id, current_version_id, latest_attempt_id, certificate_id, status, valid_until)
         values ($1,$2,$3,$4,$5,$6,$7,'compliant', now() + interval '363 days')`,
        [org, property, ctId, site.induction_id, site.version_id, attemptId, certId],
      );
    }

    console.log("\n✅ Seed complete.\n");
    console.log("Admin login:");
    console.log(`  URL:      /admin/login`);
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}\n`);
    console.log("Contractor induction links:");
    for (const l of links) console.log(`  ${l.title}\n    ${l.url}`);
  });
  await closePools();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
