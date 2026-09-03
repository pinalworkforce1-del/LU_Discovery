"use client";

import {
  Accessibility,
  ArrowLeft,
  Check,
  ClipboardList,
  ChevronRight,
  Eye,
  ExternalLink,
  ImageIcon,
  List,
  LockKeyhole,
  Map,
  Pause,
  Play,
  Printer,
  RotateCcw,
  Sparkles,
  SkipForward,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type StageId = "strengths" | "values" | "purpose" | "support" | "nextQuest";
type ScenePhase = StageId | "map";
type Hotspot = { left: string; top: string; width: string; height: string };
type Stage = { id: StageId; label: string; prompt: string };
type Question = {
  id: string;
  prompt: string;
  type: "single" | "multi" | "text";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  allowOther?: boolean;
  long?: boolean;
};
type Activity = Stage & { intro: string; questions: Question[] };
type StrengthLensItem = {
  id: string;
  title: string;
  happening: string;
  evidence: string;
  strengths: string[];
  careers: string;
  hotspot: Hotspot;
  cropImage: string;
};
type Scene = {
  slide: number;
  phase: ScenePhase;
  title: string;
  description?: string;
  image: string;
  video: string;
  activity?: StageId;
  activityHotspot?: Hotspot;
  resource?: { label: string; href: string; hotspot: Hotspot };
  nextGraphic?: boolean;
};
type VisualExplorerItem = { id: string; title: string; image: string; happening: string; evidence: string; theme: string };
type SceneExplorer = { title: string; intro: string; prompts: { title: string; detail: string; cue: string }[]; themes?: string[]; bridge?: string; visualItems?: VisualExplorerItem[] };
type ResponseValue = string | string[];
type ActivityResponse = Record<string, ResponseValue>;
type Answers = Record<StageId, ActivityResponse>;
type SavedJourney = {
  name: string;
  completed: StageId[];
  answers: Answers;
  scene: number;
  audioOn: boolean;
  exploredStrengths: string[];
  strengthLensResponses: Record<string, string>;
  playbackRate: number;
  reducedMotion: boolean;
  largeText: boolean;
  explorationSelections: Record<number, string[]>;
  completionDate: string;
  exploredVisuals: Record<number, string[]>;
};

const STORAGE_KEY = "level-up-discovery-pilot-v3";
const hotspot = (left: string, top: string, width: string, height: string): Hotspot => ({ left, top, width, height });
const asset = (slide: number, type: "image" | "video") =>
  `${import.meta.env.BASE_URL}assets/discovery/scenes/${type === "image" ? "slide" : "narration"}-${String(slide).padStart(2, "0")}.${type === "image" ? "webp" : "mp4"}`;

const STRENGTH_OPTIONS = [
  "I enjoy helping people.",
  "I stay calm when things get stressful.",
  "I like solving problems.",
  "I enjoy building or fixing things.",
  "I'm creative.",
  "I'm dependable.",
  "I enjoy learning new things.",
  "I work well with others.",
  "I like being organized.",
  "I enjoy leading others.",
  "I'm a good listener.",
  "I adapt quickly to change.",
];

const VALUE_OPTIONS = ["Helping Others", "Independence", "Family", "Adventure", "Creativity", "Learning", "Stability", "Respect", "Leadership", "Financial Security"];

const ACTIVITIES: Activity[] = [
  {
    id: "strengths",
    label: "Strengths",
    prompt: "Discover Your Strengths",
    intro: "Everyone has strengths—even if they haven't recognized them yet. There are no right or wrong answers.",
    questions: [
      { id: "most_like_me", prompt: "Which of these feels most like you?", type: "multi", options: STRENGTH_OPTIONS, max: 3, allowOther: true },
      { id: "proudest_strength", prompt: "Which strength are you most proud of?", type: "single", options: STRENGTH_OPTIONS, required: true, allowOther: true },
      { id: "strength_setting", prompt: "When have you used this strength?", type: "single", required: true, options: ["At school", "At work", "At home", "Playing sports", "Helping family", "Volunteering", "With friends", "In another situation"] },
      { id: "strength_story", prompt: "Tell us about that moment.", type: "text", required: true, long: true },
      { id: "growth_skill", prompt: "Which skill would you like to grow even more?", type: "single", required: true, options: ["Communication", "Leadership", "Problem Solving", "Teamwork", "Organization", "Creativity", "Confidence", "Adaptability", "Time Management", "Helping Others", "Technical Skills", "Learning New Things"] },
    ],
  },
  {
    id: "values",
    label: "Values",
    prompt: "Choose What Matters",
    intro: "Your Guiding Stars can help you recognize the opportunities that fit you best.",
    questions: [
      { id: "guiding_stars", prompt: "Choose FIVE Guiding Stars that matter most to you today.", type: "multi", options: VALUE_OPTIONS, min: 5, max: 5 },
      { id: "brightest_star", prompt: "Which ONE of those Guiding Stars shines the brightest for you today?", type: "single", options: VALUE_OPTIONS },
      { id: "value_reason", prompt: "Tell me why you chose that one.", type: "text", required: true, long: true },
    ],
  },
  {
    id: "purpose",
    label: "Purpose",
    prompt: "Discover Your Why",
    intro: "Look for the ideas and motivations that can keep you moving toward the future you want.",
    questions: [
      { id: "purpose_statement", prompt: "Which of these statements feels most like you?", type: "single", required: true, options: ["I love helping people succeed.", "I enjoy solving difficult problems.", "I like building or creating things.", "I enjoy teaching or explaining.", "I like bringing people together.", "I enjoy improving how things work.", "I enjoy protecting or serving others.", "I love learning and discovering new ideas.", "Something else completely."] },
      { id: "common_thread", prompt: "When doing activities that feel most like you, what do those moments have in common?", type: "text", required: true, long: true },
      { id: "five_years", prompt: "Five years from now, I hope people describe me as someone who…", type: "text", required: true, long: true },
      { id: "keep_going", prompt: "If life becomes difficult, which statement would help you keep going?", type: "single", required: true, allowOther: true, options: ["My future is worth working for.", "My family is counting on me.", "I want to prove to myself that I can succeed.", "Every small step matters.", "I want opportunities I didn't have before.", "I don't know yet…but I'm ready to find out."] },
    ],
  },
  {
    id: "support",
    label: "Support",
    prompt: "Identify Your Support",
    intro: "Naming a challenge is a first step toward finding the people and resources that can help.",
    questions: [
      { id: "challenges", prompt: "What challenges could make it harder for you to reach your goals over the next 6–12 months?", type: "multi", required: true, options: ["I don't have reliable transportation.", "I need help getting to work or training.", "I need to finish high school or earn my GED.", "I want more education or training.", "Money is a challenge right now.", "I need help paying for work-related expenses.", "Childcare or family responsibilities.", "Caring for someone else.", "Stable housing is a concern.", "Physical health.", "Mental health.", "Recovery.", "Balancing work, school, and family.", "I'm not sure where to start.", "I worry I'm not ready.", "Something else I'd like to discuss with my Career Coach."] },
      { id: "biggest_difference", prompt: "Which one of these challenges, if solved, would make the biggest difference in helping you move forward?", type: "text", required: true, long: true },
    ],
  },
  {
    id: "nextQuest",
    label: "Next Quest",
    prompt: "Choose Your Next Quest",
    intro: "Turn what you discovered into one clear next step.",
    questions: [
      { id: "goal", prompt: "What is one goal that would move you closer to the future you want to build?", type: "single", required: true, allowOther: true, options: ["Complete a Paid Work Experience", "Earn a credential", "Graduate High School / GED", "Get my driver's license", "Find a job", "Improve my résumé", "Practice interviewing", "Explore careers", "Attend college", "Complete training", "Start an apprenticeship", "Build confidence"] },
      { id: "goal_reason", prompt: "Why does that goal matter to you?", type: "text", required: true, long: true },
    ],
  },
];

const STAGES: Stage[] = ACTIVITIES.map(({ id, label, prompt }) => ({ id, label, prompt }));

const STRENGTH_LENS: StrengthLensItem[] = [
  {
    id: "build-teach",
    title: "Problem Solving & Teaching",
    happening: "A young person is building an electronics project with a child and helping them participate in the process.",
    evidence: "They are working carefully with small parts, testing how pieces fit, and guiding someone else with patience.",
    strengths: ["Problem solving", "Teaching", "Patience", "Technical thinking"],
    careers: "These strengths can show up in technical support, education, repair, manufacturing, and team training.",
    hotspot: hotspot("0%", "0%", "34.5%", "38.5%"),
    cropImage: "assets/discovery/strength-lens/build-teach.webp",
  },
  {
    id: "listen-connect",
    title: "Listening & Communication",
    happening: "Two young people are having a focused conversation at an outdoor table.",
    evidence: "They are facing each other, listening closely, and taking turns sharing ideas instead of talking past one another.",
    strengths: ["Listening", "Communication", "Empathy", "Building trust"],
    careers: "These strengths matter in customer service, healthcare, leadership, counseling, sales, and almost every team environment.",
    hotspot: hotspot("34.5%", "0%", "34%", "38.5%"),
    cropImage: "assets/discovery/strength-lens/listen-connect.webp",
  },
  {
    id: "repair-persist",
    title: "Troubleshooting & Persistence",
    happening: "A young person is examining and repairing the moving parts of a bicycle.",
    evidence: "They are staying with the problem, inspecting details, and making a practical adjustment rather than giving up.",
    strengths: ["Troubleshooting", "Persistence", "Attention to detail", "Working with your hands"],
    careers: "These strengths can travel into automotive work, maintenance, construction, manufacturing, utilities, and IT support.",
    hotspot: hotspot("68.5%", "0%", "31.5%", "38.5%"),
    cropImage: "assets/discovery/strength-lens/repair-persist.webp",
  },
  {
    id: "create-design",
    title: "Creativity & Digital Skills",
    happening: "A young person is using a digital drawing tablet to develop an original visual design.",
    evidence: "They are combining imagination with a technical tool, making choices, and refining details as the idea develops.",
    strengths: ["Creativity", "Digital skills", "Visual thinking", "Focus"],
    careers: "These strengths can appear in design, marketing, media, engineering, architecture, communications, and technology.",
    hotspot: hotspot("0%", "38.5%", "30.5%", "43.5%"),
    cropImage: "assets/discovery/strength-lens/create-design.webp",
  },
  {
    id: "solve-together",
    title: "Teamwork & Technical Thinking",
    happening: "A group of young people is working together on a wiring or electronics challenge.",
    evidence: "One person is handling the equipment while the others observe, discuss, and contribute to the solution.",
    strengths: ["Teamwork", "Technical thinking", "Cooperation", "Shared problem solving"],
    careers: "These strengths are valuable in skilled trades, IT, engineering, manufacturing, logistics, and project teams.",
    hotspot: hotspot("30.5%", "38.5%", "26.5%", "43.5%"),
    cropImage: "assets/discovery/strength-lens/solve-together.webp",
  },
  {
    id: "learn-help",
    title: "Helping, Learning & Patience",
    happening: "A young person is preparing food alongside an older adult and learning through a shared task.",
    evidence: "They are paying attention, contributing to the work, and building connection while learning from someone else.",
    strengths: ["Helping others", "Learning", "Patience", "Following a process"],
    careers: "These strengths can show up in healthcare, hospitality, education, food service, community work, and caregiving.",
    hotspot: hotspot("57%", "38.5%", "25%", "43.5%"),
    cropImage: "assets/discovery/strength-lens/learn-help.webp",
  },
  {
    id: "show-up",
    title: "Dependability & Supporting Others",
    happening: "A young person is carrying groceries and helping with an everyday responsibility.",
    evidence: "They noticed something that needed to be done, followed through, and made another person's day easier.",
    strengths: ["Dependability", "Helping others", "Responsibility", "Initiative"],
    careers: "These strengths are essential in healthcare, customer service, operations, logistics, public service, and leadership.",
    hotspot: hotspot("82%", "38.5%", "18%", "43.5%"),
    cropImage: "assets/discovery/strength-lens/show-up.webp",
  },
];

const SCENES: Scene[] = [
  { slide: 1, phase: "strengths", title: "Your Discovery Begins", image: asset(1, "image"), video: asset(1, "video") },
  { slide: 2, phase: "strengths", title: "Meet Your Guide", image: asset(2, "image"), video: asset(2, "video") },
  { slide: 3, phase: "strengths", title: "Your Story", image: asset(3, "image"), video: asset(3, "video") },
  { slide: 4, phase: "strengths", title: "Notice Your Strengths", image: asset(4, "image"), video: asset(4, "video") },
  {
    slide: 5,
    phase: "strengths",
    title: "Strengths in Action",
    description: "A collage showing a young person building electronics with a child, listening to a friend, repairing a bicycle, creating digital art, solving a technical problem with peers, preparing food with an older adult, and helping carry groceries.",
    image: asset(5, "image"),
    video: asset(5, "video"),
    resource: {
      label: "Awaken, Nurture and Empower Your Strengths",
      href: "https://youtu.be/U_l0p2v4nfg?si=pWw6mUcBFdsB6s8M",
      hotspot: hotspot("14%", "67%", "20%", "19%"),
    },
    nextGraphic: true,
  },
  {
    slide: 6,
    phase: "strengths",
    title: "Strengths Reflection",
    image: asset(6, "image"),
    video: asset(6, "video"),
    activity: "strengths",
    activityHotspot: hotspot("72%", "17%", "12%", "20%"),
    nextGraphic: true,
  },
  { slide: 7, phase: "values", title: "Values Around You", image: asset(7, "image"), video: asset(7, "video") },
  { slide: 8, phase: "values", title: "What Matters", image: asset(8, "image"), video: asset(8, "video") },
  {
    slide: 9,
    phase: "values",
    title: "Explore Your Values",
    image: asset(9, "image"),
    video: asset(9, "video"),
    resource: {
      label: "Values Video",
      href: "https://youtu.be/aKNUkN3yWTw?si=Nsjgs6lJIWU5ulrS",
      hotspot: hotspot("27%", "20%", "15%", "26%"),
    },
    nextGraphic: true,
  },
  {
    slide: 10,
    phase: "values",
    title: "Values Reflection",
    image: asset(10, "image"),
    video: asset(10, "video"),
    activity: "values",
    activityHotspot: hotspot("32%", "67%", "21%", "18%"),
    nextGraphic: true,
  },
  { slide: 11, phase: "purpose", title: "Purpose Begins", image: asset(11, "image"), video: asset(11, "video") },
  { slide: 12, phase: "purpose", title: "Your Story and Motivation", image: asset(12, "image"), video: asset(12, "video") },
  {
    slide: 13,
    phase: "purpose",
    title: "Explore Your Why",
    image: asset(13, "image"),
    video: asset(13, "video"),
    resource: {
      label: "Find Fulfillment — Find Your Why",
      href: "https://youtu.be/rvqvLF5UpRk?si=szoChvTy8Xj6mQYM",
      hotspot: hotspot("39%", "62%", "21%", "22%"),
    },
    nextGraphic: true,
  },
  {
    slide: 14,
    phase: "purpose",
    title: "Purpose Reflection",
    image: asset(14, "image"),
    video: asset(14, "video"),
    activity: "purpose",
    activityHotspot: hotspot("1.5%", "50%", "22%", "34%"),
    nextGraphic: true,
  },
  { slide: 15, phase: "support", title: "The Road Ahead", image: asset(15, "image"), video: asset(15, "video") },
  { slide: 16, phase: "support", title: "Strength for the Journey", image: asset(16, "image"), video: asset(16, "video") },
  {
    slide: 17,
    phase: "support",
    title: "Support Reflection",
    image: asset(17, "image"),
    video: asset(17, "video"),
    activity: "support",
    activityHotspot: hotspot("29%", "28%", "32%", "45%"),
    nextGraphic: true,
  },
  { slide: 18, phase: "nextQuest", title: "Your Growth", image: asset(18, "image"), video: asset(18, "video") },
  { slide: 19, phase: "nextQuest", title: "Knowing Yourself", image: asset(19, "image"), video: asset(19, "video") },
  {
    slide: 20,
    phase: "nextQuest",
    title: "Prepare for Your Next Step",
    image: asset(20, "image"),
    video: asset(20, "video"),
    resource: {
      label: "Your Next Step Video",
      href: "https://youtu.be/4KwWbkho68E?si=7UkryJ06rPNnEkDW",
      hotspot: hotspot("65%", "58%", "14%", "20%"),
    },
    nextGraphic: true,
  },
  {
    slide: 21,
    phase: "nextQuest",
    title: "Choose Your Next Quest",
    image: asset(21, "image"),
    video: asset(21, "video"),
    activity: "nextQuest",
    activityHotspot: hotspot("34%", "39%", "21%", "39%"),
    nextGraphic: true,
  },
  { slide: 22, phase: "map", title: "Level Up Journey Map", image: asset(22, "image"), video: asset(22, "video") },
];

const SCENE_DESCRIPTIONS: Record<number, string> = {
  1: "A young person stands at a glowing overlook above the Level Up city, ready to begin a journey of self-discovery.",
  2: "The learner meets a guide in a futuristic discovery space filled with pathways representing strengths, values, purpose, and support.",
  3: "Memory-like scenes surround the learner, showing that everyday experiences can reveal skills, interests, and personal strengths.",
  4: "Two contrasting moments show the learner feeling overwhelmed by one task and deeply focused while building something meaningful.",
  5: "A collage shows strengths in action: building electronics, listening, repairing a bicycle, creating digital art, teamwork, cooking, and helping with groceries.",
  6: "The learner reaches the Strengths reflection portal, where they can identify strengths they already use and skills they want to grow.",
  7: "A lively neighborhood scene shows values through choices, relationships, work, creativity, learning, independence, and helping others.",
  8: "Glowing symbols represent possible guiding values and invite the learner to notice what matters most to them.",
  9: "A collection of everyday decisions shows how values guide choices about people, work, learning, money, and the future.",
  10: "The Values reflection portal invites the learner to choose five guiding stars and identify the value that shines brightest.",
  11: "The path continues into Purpose, where the learner begins connecting strengths and values to a reason for moving forward.",
  12: "Scenes from the learner's story suggest motivations such as helping, creating, teaching, solving problems, and improving things.",
  13: "Purpose-related moments gather around the learner, inviting them to find a common thread in experiences that feel meaningful.",
  14: "The Purpose reflection portal asks the learner to explore their why, the future they want, and what can keep them going.",
  15: "The learner faces a winding road, recognizing that goals can include uncertainty, obstacles, and moments when support matters.",
  16: "A backpack represents what the learner carries forward: discovered strengths, guiding values, purpose, and growing confidence.",
  17: "The Support reflection portal invites the learner to name challenges and consider which support would make the biggest difference.",
  18: "The learner looks back across the journey, seeing growth built from honest reflection and the willingness to ask for support.",
  19: "Strengths, values, purpose, and support come together as a clearer picture of who the learner is and where they can go next.",
  20: "A next-step scene invites the learner to turn self-knowledge into one practical goal and prepare for the path ahead.",
  21: "The Next Quest portal asks the learner to choose a goal and explain why that goal matters.",
  22: "A city map shows the Level Up journey. Discovery is complete, Resume District is unlocked, and later districts remain ahead.",
};

const SCENE_EXPLORERS: Record<number, SceneExplorer> = {
  3: { title: "Your Story Lens", intro: "Ordinary moments leave clues about who you are becoming.", prompts: [
    { title: "Notice the action", detail: "Look for a moment where someone chose to try, help, learn, create, or keep going.", cue: "What did the person actually do?" },
    { title: "Name the clue", detail: "An action can reveal patience, curiosity, courage, responsibility, or another strength.", cue: "What quality might that action show?" },
    { title: "Connect it to you", detail: "Your own story contains moments like these—even when they did not feel important at the time.", cue: "What moment from your life comes to mind?" },
  ]},
  4: { title: "Energy Check", intro: "The same person can feel very different in two situations.", prompts: [
    { title: "Drained", detail: "Overwhelm can be a clue that the task, setting, support, or timing is not working yet.", cue: "What could make this moment easier?" },
    { title: "Engaged", detail: "Focus and energy often appear when a task connects with an interest or a strength.", cue: "What is helping the person stay engaged?" },
    { title: "The difference", detail: "Strength discovery is not about being good at everything. It is about noticing where you come alive and what helps you succeed.", cue: "When do you feel most focused?" },
  ]},
  7: { title: "Values in the Neighborhood", intro: "Values become visible through choices and priorities.", themes: ["Helping Others", "Family", "Respect", "Belonging", "Learning", "Creativity", "Independence", "Stability"], bridge: "Which values do you notice in the scene? Choose any that stand out.", prompts: [
    { title: "People", detail: "Helping, family, friendship, respect, and belonging can guide how someone spends time and treats others.", cue: "Where do you see connection?" },
    { title: "Possibility", detail: "Learning, creativity, independence, stability, and adventure can shape what opportunities feel right.", cue: "Where do you see someone building a future?" },
    { title: "Your choice", detail: "Two people can choose differently and both be acting from meaningful values.", cue: "Which part of this scene draws you first?" },
  ]},
  9: { title: "Values in Action", intro: "Explore each moment to see how a choice can reveal what matters.", themes: VALUE_OPTIONS, bridge: "Select any values that feel meaningful to you.", visualItems: [
    { id: "comfort-friend", title: "Belonging to a Team", image: "assets/discovery/value-lens/comfort-friend.webp", happening: "Teammates gather around a player who is down on the court.", evidence: "They stop, stay close, and make sure the person is not facing the moment alone.", theme: "Respect" },
    { id: "honest-talk", title: "Having an Honest Conversation", image: "assets/discovery/value-lens/honest-talk.webp", happening: "Two people speak face-to-face during a serious conversation.", evidence: "They remain present, listen, and give the conversation their full attention.", theme: "Respect" },
    { id: "responsibility", title: "Handling Responsibilities", image: "assets/discovery/value-lens/responsibility.webp", happening: "A young person manages groceries and an everyday responsibility.", evidence: "They are taking care of a practical need and following through for themselves or others.", theme: "Stability" },
    { id: "shared-project", title: "Solving Something Together", image: "assets/discovery/value-lens/shared-project.webp", happening: "Two people work side-by-side on a hands-on technical project.", evidence: "They share tools, ideas, and attention while working toward the same result.", theme: "Creativity" },
    { id: "think-it-through", title: "Investing in the Future", image: "assets/discovery/value-lens/think-it-through.webp", happening: "A young person studies independently at a focused workspace.", evidence: "They devote time and effort now to build knowledge and future options.", theme: "Learning" },
    { id: "support-family", title: "Empathy & Being Present", image: "assets/discovery/value-lens/support-family.webp", happening: "A young person notices that someone appears upset and stays beside them.", evidence: "They lean in, pay attention, and give the other person space to be heard.", theme: "Helping Others" },
  ], prompts: [
    { title: "What is being protected?", detail: "A decision may protect time, family, independence, safety, learning, or financial stability.", cue: "What matters enough to influence the choice?" },
    { title: "What is the tradeoff?", detail: "Real decisions can involve two important values pulling in different directions.", cue: "What might the person gain or give up?" },
    { title: "What fits you?", detail: "Knowing your values helps you explain why one opportunity may fit better than another.", cue: "What would guide your decision?" },
  ]},
  12: { title: "Motivation Lens", intro: "Purpose often grows from repeated moments that feel meaningful.", themes: ["Helping", "Teaching", "Creating", "Encouraging", "Building", "Learning", "Improving", "Solving"], bridge: "Which motivations appear to repeat?", prompts: [
    { title: "Look for a pattern", detail: "Helping, building, explaining, protecting, learning, and improving are possible threads.", cue: "What action repeats across the memories?" },
    { title: "Notice who benefits", detail: "Purpose can connect to yourself, people you care about, a community, or a problem you want to solve.", cue: "Who or what becomes better?" },
    { title: "Name the feeling", detail: "Pride, energy, curiosity, connection, and usefulness can signal that a moment matters.", cue: "How might this moment feel?" },
  ]},
  13: { title: "Find the Pattern in Your Why", intro: "Explore the memories and uncover the motivation beneath each action.", themes: ["Helping", "Teaching", "Creating", "Encouraging", "Building", "Learning", "Improving"], bridge: "Select the motivations you feel drawn toward. You can revise them during your reflection.", visualItems: [
    { id: "younger-student", title: "Helping a Younger Student", image: "assets/discovery/why-lens/younger-student.webp", happening: "A young person works beside a younger student on a detailed project.", evidence: "They slow down, share attention, and help someone else participate successfully.", theme: "Helping" },
    { id: "building-models", title: "Building Models", image: "assets/discovery/why-lens/building-models.webp", happening: "A young person concentrates on assembling and refining a model.", evidence: "They turn an idea into something tangible through focus and repeated adjustment.", theme: "Building" },
    { id: "teaching-basketball", title: "Teaching Basketball", image: "assets/discovery/why-lens/teaching-basketball.webp", happening: "A young person shows a child how to handle a basketball.", evidence: "They demonstrate, explain, and encourage someone who is still learning.", theme: "Teaching" },
    { id: "helping-family", title: "Helping Family", image: "assets/discovery/why-lens/helping-family.webp", happening: "A young person carries groceries alongside an older family member.", evidence: "They contribute to an everyday need and make the responsibility easier to manage.", theme: "Helping" },
    { id: "repairing-bike", title: "Repairing a Bike", image: "assets/discovery/why-lens/repairing-bike.webp", happening: "A young person and an older adult work together on a bicycle repair.", evidence: "They examine the problem, use tools, and improve something that was not working.", theme: "Improving" },
    { id: "volunteering", title: "Volunteering", image: "assets/discovery/why-lens/volunteering.webp", happening: "A young person helps organize or distribute supplies with a group.", evidence: "They give time and effort toward a shared community need.", theme: "Encouraging" },
    { id: "drawing-ideas", title: "Drawing Ideas", image: "assets/discovery/why-lens/drawing-ideas.webp", happening: "A young person develops an idea through drawing and design.", evidence: "They imagine possibilities and make those ideas visible.", theme: "Creating" },
    { id: "learning-skills", title: "Learning New Skills", image: "assets/discovery/why-lens/learning-skills.webp", happening: "A young person studies and practices at a focused workspace.", evidence: "They invest attention and effort in becoming more capable over time.", theme: "Learning" },
  ], prompts: [
    { title: "Explore the photographs", detail: "Helping a student, building models, teaching basketball, helping family, repairing, drawing, volunteering, and learning are all visible actions.", cue: "Which moments feel meaningful to you?" },
    { title: "Follow the connections", detail: "Different activities can share the same motivation. Building a model and repairing a bike may both connect to creating or improving.", cue: "Which labels connect more than one experience?" },
    { title: "Find your possible thread", detail: "A purpose is not a job title. It can be a motivation that travels with you into many roles.", cue: "What motivation would you want more of in your future?" },
  ]},
  16: { title: "Open Your Discovery Backpack", intro: "You are not starting the next part of the journey empty-handed.", prompts: [
    { title: "Strengths", detail: "Skills and qualities you already use can help you take the next step.", cue: "Which strength will you carry forward?" },
    { title: "Values", detail: "Your guiding stars can help you evaluate opportunities and make choices.", cue: "What must your next step honor?" },
    { title: "Purpose", detail: "Your why can help you keep moving when the path becomes difficult.", cue: "What reason will help you persist?" },
  ]},
  17: { title: "Support Scanner", intro: "A challenge is information—not a judgment about your ability.", themes: ["Transportation", "Education or training", "Work expenses", "Family responsibilities", "Housing", "Health and wellness", "Balancing responsibilities", "Confidence and direction", "Career coach support"], bridge: "Which kinds of support could make the path easier?", prompts: [
    { title: "Practical barriers", detail: "Transportation, schedules, money, housing, childcare, or equipment can affect the path.", cue: "What practical support could remove friction?" },
    { title: "Learning support", detail: "Training, practice, clear information, and a coach can turn uncertainty into a plan.", cue: "What would help you feel more prepared?" },
    { title: "People support", detail: "Family, peers, mentors, employers, and career coaches can each play a different role.", cue: "Who could be part of your support team?" },
  ]},
  20: { title: "Next-Step Builder", intro: "A strong next step is clear enough to begin and meaningful enough to matter.", prompts: [
    { title: "Make it specific", detail: "Choose one action you can describe clearly instead of trying to solve everything at once.", cue: "What exactly will you do?" },
    { title: "Make it reachable", detail: "The next step should stretch you without requiring every future answer today.", cue: "What could you begin soon?" },
    { title: "Connect it to your why", detail: "A goal becomes more durable when you know why it matters to you.", cue: "What will this step make possible?" },
  ]},
};

const PHASE_START: Record<StageId, number> = { strengths: 0, values: 6, purpose: 10, support: 14, nextQuest: 17 };
const EMPTY_ANSWERS: Answers = { strengths: {}, values: {}, purpose: {}, support: {}, nextQuest: {} };
const DEFAULT_JOURNEY: SavedJourney = {
  name: "",
  completed: [],
  answers: EMPTY_ANSWERS,
  scene: 0,
  audioOn: true,
  exploredStrengths: [],
  strengthLensResponses: {},
  playbackRate: 1,
  reducedMotion: false,
  largeText: false,
  explorationSelections: {},
  completionDate: "",
  exploredVisuals: {},
};

export function DiscoveryExperience() {
  const [journey, setJourney] = useState<SavedJourney>(DEFAULT_JOURNEY);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [coachSummaryOpen, setCoachSummaryOpen] = useState(false);
  const [strengthLensOpen, setStrengthLensOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [activeVisualId, setActiveVisualId] = useState("");
  const [strengthLensMode, setStrengthLensMode] = useState<"list" | "front" | "back">("list");
  const [activeStrengthId, setActiveStrengthId] = useState(STRENGTH_LENS[0].id);
  const [draftName, setDraftName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [narrationStarted, setNarrationStarted] = useState(false);
  const [narrationDone, setNarrationDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SavedJourney;
          setJourney({
            ...DEFAULT_JOURNEY,
            ...parsed,
            exploredStrengths: parsed.exploredStrengths ?? [],
            strengthLensResponses: parsed.strengthLensResponses ?? {},
            explorationSelections: parsed.explorationSelections ?? {},
            completionDate: parsed.completionDate ?? "",
            exploredVisuals: parsed.exploredVisuals ?? {},
            scene: Math.min(parsed.scene ?? 0, SCENES.length - 1),
          });
          setDraftName(parsed.name ?? "");
          setStarted(Boolean(parsed.name));
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journey));
  }, [journey, ready]);

  useEffect(() => {
    const video = videoRef.current;
    video?.pause();
    video?.load();

    const next = SCENES[journey.scene + 1];
    if (next) {
      const image = new Image();
      image.src = next.image;
      const preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "video";
      preload.href = next.video;
      document.head.appendChild(preload);
      return () => preload.remove();
    }
  }, [journey.scene]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = journey.playbackRate;
  }, [journey.playbackRate, journey.scene]);

  const scene = SCENES[journey.scene];
  const sceneExplorer = SCENE_EXPLORERS[scene.slide];
  const strengthLensAvailable = scene.slide === 5;
  const activeStrength = STRENGTH_LENS.find((item) => item.id === activeStrengthId) ?? STRENGTH_LENS[0];
  const activity = scene.activity ? ACTIVITIES.find((item) => item.id === scene.activity)! : null;
  const stage = activity;
  const currentPhase = scene.phase === "map" ? null : STAGES.find((item) => item.id === scene.phase)!;
  const xp = journey.completed.length * 100;
  const percent = journey.completed.length * 20;
  const allComplete = journey.completed.length === STAGES.length;
  const controlsVisible = started && narrationDone;
  const activityComplete = scene.activity ? journey.completed.includes(scene.activity) : true;
  const summary = useMemo(() => STAGES.map((item) => ({
    label: item.label,
    values: Object.values(journey.answers[item.id]).flat().filter(Boolean),
  })), [journey.answers]);

  function canOpenStage(index: number) {
    return index === 0 || journey.completed.includes(STAGES[index - 1].id);
  }

  function replayNarration() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = !journey.audioOn;
    video.playbackRate = journey.playbackRate;
    setNarrationStarted(true);
    setNarrationDone(false);
    video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function skipNarration() {
    videoRef.current?.pause();
    setPlaying(false);
    setNarrationStarted(true);
    setNarrationDone(true);
  }

  function startJourney() {
    const name = draftName.trim();
    if (!name) return void toast.error("Enter your first name to begin.");
    setJourney((current) => ({ ...current, name, scene: 0 }));
    setStarted(true);
    window.setTimeout(replayNarration, 120);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.ended || narrationDone) video.currentTime = 0;
      setNarrationStarted(true);
      setNarrationDone(false);
      video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function toggleAudio() {
    setJourney((current) => ({ ...current, audioOn: !current.audioOn }));
    if (videoRef.current) videoRef.current.muted = journey.audioOn;
  }

  function goToScene(index: number, play = true) {
    const safeIndex = Math.max(0, Math.min(index, SCENES.length - 1));
    videoRef.current?.pause();
    setPlaying(false);
    setNarrationStarted(false);
    setNarrationDone(false);
    setJourney((current) => ({ ...current, scene: safeIndex }));
    if (play) window.setTimeout(replayNarration, 160);
  }

  function openStrengthLens(id: string) {
    const isNew = !journey.exploredStrengths.includes(id);
    setActiveStrengthId(id);
    setStrengthLensMode("front");
    setStrengthLensOpen(true);
    if (isNew) {
      setJourney((current) => ({ ...current, exploredStrengths: [...current.exploredStrengths, id] }));
      if (journey.exploredStrengths.length === STRENGTH_LENS.length - 1) {
        toast.success("You explored every strength in this scene.", { icon: <Sparkles className="size-4 text-cyan-300" /> });
      }
    }
  }

  function openVisualLens(id: string) {
    setActiveVisualId(id);
    setExplorerOpen(true);
    setJourney((current) => {
      const explored = current.exploredVisuals[scene.slide] ?? [];
      return explored.includes(id) ? current : { ...current, exploredVisuals: { ...current.exploredVisuals, [scene.slide]: [...explored, id] } };
    });
  }

  function openStrengthList() {
    setStrengthLensMode("list");
    setStrengthLensOpen(true);
  }

  function saveStrengthLensResponse(response: string) {
    setJourney((current) => ({
      ...current,
      strengthLensResponses: { ...current.strengthLensResponses, [activeStrengthId]: response },
    }));
  }

  function moveStrengthLens(direction: -1 | 1) {
    const currentIndex = STRENGTH_LENS.findIndex((item) => item.id === activeStrengthId);
    const nextIndex = (currentIndex + direction + STRENGTH_LENS.length) % STRENGTH_LENS.length;
    openStrengthLens(STRENGTH_LENS[nextIndex].id);
  }

  function saveActivity(responses: ActivityResponse) {
    if (!stage) return;
    const alreadyComplete = journey.completed.includes(stage.id);
    setJourney((current) => ({
      ...current,
      answers: { ...current.answers, [stage.id]: responses },
      completed: alreadyComplete ? current.completed : [...current.completed, stage.id],
      completionDate: stage.id === "nextQuest" ? (current.completionDate || new Date().toISOString()) : current.completionDate,
    }));
    setActivityOpen(false);
    setStrengthLensOpen(false);
    toast.success(alreadyComplete ? "Reflection updated" : "+100 XP — Reflection complete", {
      icon: <Sparkles className="size-4 text-cyan-300" />,
    });
  }

  function continueScene() {
    if (scene.activity && !activityComplete) return void setActivityOpen(true);
    if (journey.scene < SCENES.length - 1) goToScene(journey.scene + 1);
  }

  function resetJourney() {
    if (!window.confirm("Restart Discovery and clear the saved reflections on this device?")) return;
    setJourney(DEFAULT_JOURNEY);
    setDraftName("");
    setStarted(false);
    setActivityOpen(false);
    setNarrationStarted(false);
    setNarrationDone(false);
    toast("Discovery restarted");
  }

  if (!ready) return <main className="level-up-shell" aria-label="Loading Discovery" />;

  return (
    <main className={`level-up-shell ${journey.largeText ? "large-text" : ""} ${journey.reducedMotion ? "reduce-motion" : ""}`}>
      <Toaster theme="dark" position="top-center" richColors />
      <header className="level-up-topbar">
        <div className="brand-lockup" aria-label="Level Up Discovery">
          <span className="brand-mark">LU</span>
          <div><strong>LEVEL UP</strong><span>DISCOVERY</span></div>
        </div>
        <div className="topbar-progress">
          <div className="progress-copy">
            <span>{scene.phase === "map" ? "Discovery complete" : currentPhase?.label}</span>
            <span className="scene-counter">Scene {scene.slide} of 22</span>
            <strong>{xp} XP</strong>
          </div>
          <Progress value={percent} aria-label={`${percent}% complete`} />
        </div>
        <div className="topbar-actions">
          {started ? <Button className="hud-button" variant="ghost" size="icon" onClick={() => setCoachSummaryOpen(true)} aria-label="Open Discovery Coach Snapshot"><ClipboardList /></Button> : null}
          <Button className="hud-button" variant="ghost" size="icon" onClick={() => setAccessibilityOpen(true)} aria-label="Open accessibility and scene description"><Accessibility /></Button>
          <Button className="hud-button" variant="ghost" size="icon" onClick={togglePlayback} aria-label={playing ? "Pause narration" : "Play narration"}>{playing ? <Pause /> : <Play />}</Button>
          <Button className="hud-button" variant="ghost" size="icon" onClick={toggleAudio} aria-label={journey.audioOn ? "Mute narration" : "Turn on narration"}>{journey.audioOn ? <Volume2 /> : <VolumeX />}</Button>
          <Button className="hud-button" variant="ghost" size="icon" onClick={resetJourney} aria-label="Restart Discovery"><RotateCcw /></Button>
        </div>
      </header>

      <section className="game-stage" aria-live="polite">
        <div className="scene-frame">
          <img key={scene.image} className="scene-artwork" src={scene.image} alt={scene.description ?? SCENE_DESCRIPTIONS[scene.slide]} draggable={false} loading="eager" fetchPriority="high" onError={(event) => { if (scene.slide === 8 && event.currentTarget.dataset.fallback !== "true") { event.currentTarget.dataset.fallback = "true"; event.currentTarget.src = "assets/discovery/scenes/slide-08.jpg"; } }} />
          <div className={`caption-mask ${narrationStarted && !narrationDone ? "is-visible" : ""}`} aria-hidden="true" />
          <video
            ref={videoRef}
            className={`caption-video ${playing ? "is-playing" : ""}`}
            playsInline
            preload="metadata"
            muted={!journey.audioOn}
            onPlay={() => { setPlaying(true); setNarrationStarted(true); setNarrationDone(false); }}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setNarrationDone(true); }}
          >
            <source src={scene.video} type="video/mp4" />
          </video>

          {!started ? (
            <div className="start-panel">
              <p className="eyebrow">YOUR STORY STARTS HERE</p>
              <h1>What makes you, you?</h1>
              <p>Discover the strengths, values, purpose, and support that can shape your next move.</p>
              <label htmlFor="first-name">What should we call you?</label>
              <div className="name-row">
                <input id="first-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && startJourney()} placeholder="First name" autoComplete="given-name" />
                <Button onClick={startJourney} size="lg">Begin Discovery <ChevronRight /></Button>
              </div>
              <small>Your progress is saved on this device during the pilot.</small>
            </div>
          ) : null}

          {started && !narrationStarted ? (
            <button className="resume-narration" onClick={replayNarration}><Play /> Play narration</button>
          ) : null}

          {started && narrationStarted && !narrationDone ? (
            <button className="skip-narration" onClick={skipNarration}><SkipForward /> Skip narration</button>
          ) : null}

          {controlsVisible && strengthLensAvailable ? (
            <StrengthLensOverlay
              items={STRENGTH_LENS}
              explored={journey.exploredStrengths}
              resource={scene.resource}
              onOpen={openStrengthLens}
              onOpenList={openStrengthList}
            />
          ) : controlsVisible && scene.resource ? (
            <a className="world-hotspot resource-hotspot" style={scene.resource.hotspot} href={scene.resource.href} target="_blank" rel="noreferrer" aria-label={`Open ${scene.resource.label}`}>
              <span className="hotspot-ring" />
              <span className="hotspot-label"><ExternalLink /> {scene.resource.label}</span>
            </a>
          ) : null}

          {controlsVisible && sceneExplorer ? sceneExplorer.visualItems ? <VisualLensOverlay slide={scene.slide} items={sceneExplorer.visualItems} explored={journey.exploredVisuals[scene.slide] ?? []} onOpen={openVisualLens} onOpenList={() => { setActiveVisualId(""); setExplorerOpen(true); }} /> : <button className="scene-explorer-button" onClick={() => setExplorerOpen(true)}><Eye /> Look closer</button> : null}

          {controlsVisible && stage && scene.activityHotspot ? (
            <button className={`world-hotspot ${activityComplete ? "is-complete" : ""}`} style={scene.activityHotspot} onClick={() => setActivityOpen(true)} aria-label={`${activityComplete ? "Review" : "Open"} ${stage.prompt}`}>
              <span className="hotspot-ring" />
              <span className="hotspot-label">{activityComplete ? <Check /> : <Sparkles />}{activityComplete ? "Complete — review" : stage.prompt}</span>
            </button>
          ) : null}

          {controlsVisible && scene.phase !== "map" ? <LiveHud completed={journey.completed} xp={xp} /> : null}

          {controlsVisible && scene.phase !== "map" ? (
            scene.nextGraphic ? (
              <button className="next-level-button" onClick={continueScene}>
                <img src="assets/discovery/next-level.png" alt="" />
                <span className="sr-only">{scene.activity && !activityComplete ? `Complete ${stage?.label} first` : "Continue your journey"}</span>
              </button>
            ) : (
              <button className="scene-continue" onClick={continueScene}>Continue <ChevronRight /></button>
            )
          ) : null}

          {controlsVisible && scene.phase === "map" ? (
            <JourneyMap name={journey.name} onCertificate={() => setCertificateOpen(true)} onSummary={() => setCoachSummaryOpen(true)} onReview={() => goToScene(0, false)} />
          ) : null}

          {controlsVisible ? <PersonalizedMoment scene={scene.slide} journey={journey} offset={Boolean(sceneExplorer)} /> : null}
        </div>
      </section>

      <nav className="stage-nav" aria-label="Discovery levels">
        {STAGES.map((item, index) => {
          const complete = journey.completed.includes(item.id);
          const available = canOpenStage(index);
          const active = scene.phase === item.id;
          return (
            <button key={item.id} disabled={!available} aria-current={active ? "step" : undefined} className={`${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`} onClick={() => goToScene(PHASE_START[item.id])}>
              <span>{complete ? <Check /> : available ? index + 1 : <LockKeyhole />}</span>{item.label}
            </button>
          );
        })}
        <button disabled={!allComplete} aria-current={scene.phase === "map" ? "step" : undefined} className={scene.phase === "map" ? "is-active map-step" : "map-step"} onClick={() => goToScene(21)}>
          <span>{allComplete ? <Map /> : <LockKeyhole />}</span>Journey Map
        </button>
      </nav>

      {stage ? (
        <ActivityDialog key={`${stage.id}-${activityOpen}`} open={activityOpen} onOpenChange={setActivityOpen} stage={stage} initial={journey.answers[stage.id]} explorationThemes={explorationThemesFor(stage.id, journey.explorationSelections)} onSave={saveActivity} />
      ) : null}

      <StrengthLensDialog
        open={strengthLensOpen}
        onOpenChange={setStrengthLensOpen}
        mode={strengthLensMode}
        setMode={setStrengthLensMode}
        active={activeStrength}
        explored={journey.exploredStrengths}
        response={journey.strengthLensResponses[activeStrengthId] ?? ""}
        onRespond={saveStrengthLensResponse}
        onSelect={openStrengthLens}
        onMove={moveStrengthLens}
      />
      <AccessibilityDialog
        open={accessibilityOpen}
        onOpenChange={setAccessibilityOpen}
        scene={scene}
        journey={journey}
        onUpdate={(updates) => setJourney((current) => ({ ...current, ...updates }))}
      />
      {sceneExplorer ? <SceneExplorerDialog key={`${scene.slide}-${activeVisualId}`} open={explorerOpen} onOpenChange={setExplorerOpen} explorer={sceneExplorer} activeVisualId={activeVisualId} selected={journey.explorationSelections[scene.slide] ?? []} onChange={(selected) => setJourney((current) => ({ ...current, explorationSelections: { ...current.explorationSelections, [scene.slide]: selected } }))} /> : null}

      <Dialog open={certificateOpen} onOpenChange={setCertificateOpen}>
        <DialogContent className="certificate-dialog" showCloseButton>
          <DialogHeader className="sr-only"><DialogTitle>Discovery Certificate</DialogTitle><DialogDescription>Certificate earned by {journey.name}</DialogDescription></DialogHeader>
          <div className="certificate-wrap">
            <img src="assets/discovery/certificate.png" alt="Discovery certificate artwork" />
            <strong className="certificate-name">{journey.name}</strong>
            <span className="certificate-date">{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(journey.completionDate ? new Date(journey.completionDate) : new Date())}</span>
          </div>
          <DialogFooter><Button onClick={() => window.print()}><Trophy /> Print certificate</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <CoachSummaryDialog open={coachSummaryOpen} onOpenChange={setCoachSummaryOpen} journey={journey} />

      <aside className="sr-only" aria-label="Discovery summary">
        <h2>{journey.name}&apos;s Discovery Summary</h2>
        {summary.map((item) => <div key={item.label}><h3>{item.label}</h3><p>{item.values.join(", ")}</p></div>)}
      </aside>
    </main>
  );
}

function StrengthLensOverlay({ items, explored, resource, onOpen, onOpenList }: {
  items: StrengthLensItem[];
  explored: string[];
  resource?: Scene["resource"];
  onOpen: (id: string) => void;
  onOpenList: () => void;
}) {
  return (
    <div className="strength-lens-layer" aria-label="Interactive strength examples">
      <div className="strength-lens-toolbar">
        <span><Eye /> Explore strengths <b>{explored.length}/{items.length}</b></span>
        <button type="button" onClick={onOpenList}><List /> List view</button>
        {resource ? <a href={resource.href} target="_blank" rel="noreferrer"><ExternalLink /> Watch video</a> : null}
      </div>
      {items.map((item, index) => {
        const visited = explored.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`lens-hotspot ${visited ? "is-visited" : ""}`}
            style={item.hotspot}
            onClick={() => onOpen(item.id)}
            aria-label={`Explore scene ${index + 1}: ${item.title}${visited ? ". Already explored." : ""}`}
          >
            <span className="lens-hotspot-number" aria-hidden="true">{visited ? <Check /> : index + 1}</span>
            <span className="lens-hotspot-label"><Eye /> {item.title}</span>
          </button>
        );
      })}
    </div>
  );
}

function StrengthLensDialog({ open, onOpenChange, mode, setMode, active, explored, response, onRespond, onSelect, onMove }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "list" | "front" | "back";
  setMode: (mode: "list" | "front" | "back") => void;
  active: StrengthLensItem;
  explored: string[];
  response: string;
  onRespond: (response: string) => void;
  onSelect: (id: string) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const activeIndex = STRENGTH_LENS.findIndex((item) => item.id === active.id);
  const reflections = ["Yes — this feels like me", "Maybe — I'm still figuring it out", "Not yet — I want to explore it"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="strength-lens-dialog">
        {mode === "list" ? (
          <>
            <DialogHeader>
              <p className="activity-kicker">STRENGTH LENS • ACCESSIBLE LIST</p>
              <DialogTitle>Explore strengths in action</DialogTitle>
              <DialogDescription>Choose any scene. There is no required order, and this exploration does not affect your score.</DialogDescription>
            </DialogHeader>
            <div className="lens-list-progress"><Progress value={(explored.length / STRENGTH_LENS.length) * 100} /><span>{explored.length} of {STRENGTH_LENS.length} explored</span></div>
            <div className="strength-lens-list">
              {STRENGTH_LENS.map((item, index) => (
  <button
    key={item.id}
    type="button"
    className={explored.includes(item.id) ? "is-visited" : ""}
    onClick={() => onSelect(item.id)}
  >
    <span>{explored.includes(item.id) ? <Check /> : index + 1}</span>
    <div>
      <strong>{item.title}</strong>
      <small>{item.strengths.join(" • ")}</small>
    </div>
    <ChevronRight />
  </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="activity-meta"><p className="activity-kicker">STRENGTH LENS</p><span>Scene {activeIndex + 1} of {STRENGTH_LENS.length}</span></div>
              <DialogTitle>{active.title}</DialogTitle>
              <DialogDescription>{mode === "front" ? "Look closely at what the person is doing, then explore the strength." : "Strengths become visible through actions and choices."}</DialogDescription>
            </DialogHeader>

            {mode === "front" ? (
              <section key={`front-${active.id}`} className="lens-card lens-card-front">
                <div className="lens-scene-crop"><img src={active.cropImage} alt={active.happening} /></div>
                <div className="lens-front-copy"><p>What strengths can you see here?</p><Button onClick={() => setMode("back")}><Eye /> Explore this strength</Button></div>
              </section>
            ) : (
              <section key={`back-${active.id}`} className="lens-card lens-card-back">
                <div className="lens-explanation-grid">
                  <article><span>WHAT IS HAPPENING?</span><p>{active.happening}</p></article>
                  <article><span>HOW DO WE KNOW?</span><p>{active.evidence}</p></article>
                  <article><span>STRENGTHS IN ACTION</span><div className="strength-tags">{active.strengths.map((strength) => <b key={strength}>{strength}</b>)}</div></article>
                  <article><span>WHERE CAN IT SHOW UP?</span><p>{active.careers}</p></article>
                </div>
                <div className="lens-reflection">
                  <strong>Have you used strengths like these before?</strong>
                  <div>{reflections.map((option) => <button key={option} type="button" aria-pressed={response === option} className={response === option ? "selected" : ""} onClick={() => onRespond(option)}>{response === option ? <Check /> : null}{option}</button>)}</div>
                </div>
                <Button variant="outline" onClick={() => setMode("front")}><ImageIcon /> Show image again</Button>
              </section>
            )}

            <DialogFooter className="lens-dialog-nav">
              <Button variant="ghost" onClick={() => onMove(-1)}><ArrowLeft /> Previous</Button>
              <Button variant="outline" onClick={() => setMode("list")}><List /> All scenes</Button>
              <Button variant="ghost" onClick={() => onMove(1)}>Next <ChevronRight /></Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccessibilityDialog({ open, onOpenChange, scene, journey, onUpdate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: Scene;
  journey: SavedJourney;
  onUpdate: (updates: Partial<SavedJourney>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="accessibility-dialog">
        <DialogHeader>
          <p className="activity-kicker">ACCESSIBILITY • SCENE {scene.slide} OF 22</p>
          <DialogTitle>{scene.title}</DialogTitle>
          <DialogDescription>Adjust the experience at any time. Your choices are saved on this device.</DialogDescription>
        </DialogHeader>
        <section className="scene-description" aria-labelledby="scene-description-title">
          <div><Eye /><strong id="scene-description-title">Describe this scene</strong></div>
          <p>{scene.description ?? SCENE_DESCRIPTIONS[scene.slide]}</p>
        </section>
        <section className="accessibility-options" aria-label="Accessibility preferences">
          <div className="preference-row">
            <div><strong>Larger interface text</strong><span>Increases controls and readable text without changing the artwork.</span></div>
            <Switch checked={journey.largeText} onCheckedChange={(checked) => onUpdate({ largeText: checked })} aria-label="Use larger interface text" />
          </div>
          <div className="preference-row">
            <div><strong>Reduce motion</strong><span>Turns off pulses, flips, and decorative movement.</span></div>
            <Switch checked={journey.reducedMotion} onCheckedChange={(checked) => onUpdate({ reducedMotion: checked })} aria-label="Reduce motion" />
          </div>
          <fieldset className="speed-options">
            <legend>Narration speed</legend>
            <div>{[0.75, 1, 1.25, 1.5].map((rate) => <button key={rate} type="button" aria-pressed={journey.playbackRate === rate} className={journey.playbackRate === rate ? "selected" : ""} onClick={() => onUpdate({ playbackRate: rate })}>{rate}×</button>)}</div>
          </fieldset>
        </section>
        <p className="caption-note">Captions appear with every narration video. You can pause, replay, mute, change speed, or skip narration without losing access to the scene.</p>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Return to Discovery</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisualLensOverlay({ slide, items, explored, onOpen, onOpenList }: { slide: number; items: VisualExplorerItem[]; explored: string[]; onOpen: (id: string) => void; onOpenList: () => void }) {
  const valuesHotspots = [hotspot("0%", "0%", "34%", "45%"), hotspot("34%", "0%", "34%", "45%"), hotspot("68%", "0%", "32%", "54%"), hotspot("0%", "45%", "35%", "38%"), hotspot("35%", "45%", "36%", "38%"), hotspot("71%", "54%", "29%", "29%")];
  const whyHotspots = [hotspot("5%", "5%", "17%", "18%"), hotspot("22%", "4%", "18%", "18%"), hotspot("40%", "4%", "18%", "19%"), hotspot("61%", "5%", "18%", "19%"), hotspot("4.5%", "26%", "17%", "20%"), hotspot("60%", "27%", "18%", "20%"), hotspot("4%", "51%", "18%", "21%"), hotspot("58%", "52%", "19%", "21%")];
  const positions = slide === 13 ? whyHotspots : valuesHotspots;
  return <div className="visual-lens-layer" aria-label={`Interactive ${slide === 13 ? "motivation" : "value"} moments`}>
    <div className="visual-lens-toolbar"><span><Eye /> Explore moments <b>{explored.length}/{items.length}</b></span><button type="button" onClick={onOpenList}><List /> Card view</button></div>
    {items.map((item, index) => <button key={item.id} type="button" className={`visual-master-hotspot ${explored.includes(item.id) ? "is-visited" : ""}`} style={positions[index]} onClick={() => onOpen(item.id)} aria-label={`Explore ${item.title}${explored.includes(item.id) ? ". Already explored." : ""}`}><span>{explored.includes(item.id) ? <Check /> : index + 1}</span><b><Eye /> {item.title}</b></button>)}
  </div>;
}

function SceneExplorerDialog({ open, onOpenChange, explorer, activeVisualId, selected, onChange }: { open: boolean; onOpenChange: (open: boolean) => void; explorer: SceneExplorer; activeVisualId: string; selected: string[]; onChange: (selected: string[]) => void }) {
  const [flipped, setFlipped] = useState<string[]>(activeVisualId ? [activeVisualId] : []);
  const visualItems = activeVisualId && explorer.visualItems ? [...explorer.visualItems].sort((a, b) => a.id === activeVisualId ? -1 : b.id === activeVisualId ? 1 : 0) : explorer.visualItems;
  function toggle(theme: string) {
    onChange(selected.includes(theme) ? selected.filter((item) => item !== theme) : [...selected, theme]);
  }
  function flip(id: string) {
    setFlipped((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scene-explorer-dialog">
        <DialogHeader><p className="activity-kicker">DISCOVERY LENS</p><DialogTitle>{explorer.title}</DialogTitle><DialogDescription>{explorer.intro}</DialogDescription></DialogHeader>
        {visualItems ? <div className="visual-flip-grid">{visualItems.map((item) => {
          const isFlipped = flipped.includes(item.id);
          const isSelected = selected.includes(item.theme);
          return <article key={item.id} className={isFlipped ? "is-flipped" : ""}>
            <button className="visual-flip-card" type="button" aria-expanded={isFlipped} onClick={() => flip(item.id)}>
              <span className="visual-card-front"><img src={item.image} alt={item.happening} /><b>{item.title}</b><small><Eye /> Explore this moment</small></span>
              <span className="visual-card-back"><b>{item.theme}</b><strong>What is happening?</strong><p>{item.happening}</p><strong>What is the evidence?</strong><p>{item.evidence}</p><small>Click to see the image again</small></span>
            </button>
            {isFlipped ? <button className={`visual-theme-choice ${isSelected ? "selected" : ""}`} type="button" aria-pressed={isSelected} onClick={() => toggle(item.theme)}>{isSelected ? <Check /> : <Sparkles />}{isSelected ? "Connected to me" : `This ${explorer.title.includes("Why") ? "motivation" : "value"} connects with me`}</button> : null}
          </article>;
        })}</div> : <div className="explorer-cards">{explorer.prompts.map((prompt, index) => <article key={prompt.title}><span>{index + 1}</span><div><strong>{prompt.title}</strong><p>{prompt.detail}</p><em>{prompt.cue}</em></div></article>)}</div>}
        {explorer.themes && !explorer.visualItems ? <section className="explorer-themes"><strong>{explorer.bridge}</strong><div>{explorer.themes.map((theme) => <button key={theme} type="button" aria-pressed={selected.includes(theme)} className={selected.includes(theme) ? "selected" : ""} onClick={() => toggle(theme)}>{selected.includes(theme) ? <Check /> : null}{theme}</button>)}</div><span>{selected.length ? `${selected.length} selected — these will follow you into the reflection.` : "Choose any that stand out, or continue without selecting."}</span></section> : null}
        {explorer.visualItems ? <p className="visual-selection-summary">{selected.length ? `${selected.join(" • ")} will follow you into the reflection as ideas to consider.` : explorer.bridge}</p> : null}
        <p className="caption-note">This exploration is optional. There is no right answer and it does not affect your XP.</p>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Return to scene</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function explorationThemesFor(stage: StageId, selections: Record<number, string[]>) {
  const slides: Partial<Record<StageId, number[]>> = { values: [7, 9], purpose: [12, 13], support: [17] };
  return [...new Set((slides[stage] ?? []).flatMap((slide) => selections[slide] ?? []))];
}

function answerText(journey: SavedJourney, stage: StageId, id: string) {
  const value = journey.answers[stage]?.[id];
  if (Array.isArray(value)) return value.filter(Boolean).join(" • ");
  return typeof value === "string" ? value.trim() : "";
}

function PersonalizedMoment({ scene, journey, offset }: { scene: number; journey: SavedJourney; offset: boolean }) {
  const moments: Record<number, { kicker: string; title: string; text: string }> = {
    6: { kicker: "YOUR STRENGTHS", title: answerText(journey, "strengths", "proudest_strength"), text: `Growing next: ${answerText(journey, "strengths", "growth_skill")}` },
    10: { kicker: "YOUR GUIDING STARS", title: answerText(journey, "values", "brightest_star"), text: answerText(journey, "values", "guiding_stars") },
    14: { kicker: "YOUR WHY", title: answerText(journey, "purpose", "purpose_statement"), text: answerText(journey, "purpose", "five_years") },
    16: { kicker: "DISCOVERY BACKPACK", title: answerText(journey, "strengths", "proudest_strength"), text: [answerText(journey, "values", "brightest_star"), answerText(journey, "purpose", "purpose_statement")].filter(Boolean).join(" • ") },
    17: { kicker: "SUPPORT CAN CHANGE THE PATH", title: answerText(journey, "support", "biggest_difference"), text: answerText(journey, "support", "challenges") },
    19: { kicker: `${journey.name.toUpperCase()}'S DISCOVERY`, title: answerText(journey, "purpose", "five_years"), text: [answerText(journey, "strengths", "proudest_strength"), answerText(journey, "values", "brightest_star")].filter(Boolean).join(" • ") },
    21: { kicker: "YOUR NEXT QUEST", title: answerText(journey, "nextQuest", "goal"), text: answerText(journey, "nextQuest", "goal_reason") },
  };
  const moment = moments[scene];
  if (!moment?.title) return null;
  return <aside className={`personalized-moment ${offset ? "is-offset" : ""}`} aria-label={moment.kicker}><span>{moment.kicker}</span><strong>{moment.title}</strong>{moment.text ? <p>{moment.text}</p> : null}</aside>;
}

function LiveHud({ completed, xp }: { completed: StageId[]; xp: number }) {
  return (
    <div className="live-hud">
      <strong>DISCOVERY</strong>
      <div className="hud-levels">
        {STAGES.map((item) => <span key={item.id} className={completed.includes(item.id) ? "done" : ""}>{item.label}<i>{completed.includes(item.id) ? <Check /> : null}</i></span>)}
      </div>
      <b>XP {xp}</b>
    </div>
  );
}

function ActivityDialog({ open, onOpenChange, stage, initial, explorationThemes, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; stage: Activity; initial: ActivityResponse; explorationThemes: string[]; onSave: (values: ActivityResponse) => void }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ActivityResponse>({ ...initial });
  const question = stage.questions[step];
  const rawValue = draft[question.id];
  const selected = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
  const otherKey = `${question.id}__other`;
  const otherValue = typeof draft[otherKey] === "string" ? draft[otherKey] as string : "";
  const options = stage.id === "values" && question.id === "brightest_star" && Array.isArray(draft.guiding_stars) && draft.guiding_stars.length
    ? draft.guiding_stars
    : question.options ?? [];

  function toggle(option: string) {
    if (question.type === "single") {
      setDraft((current) => ({ ...current, [question.id]: current[question.id] === option ? "" : option }));
      return;
    }
    const current = Array.isArray(draft[question.id]) ? draft[question.id] as string[] : [];
    if (current.includes(option)) {
      setDraft((values) => ({ ...values, [question.id]: current.filter((item) => item !== option) }));
    } else if (!question.max || current.length < question.max) {
      setDraft((values) => ({ ...values, [question.id]: [...current, option] }));
    }
  }

  function isValid() {
    if (question.type === "text") return !question.required || (typeof rawValue === "string" && rawValue.trim().length > 0);
    const count = selected.length;
    const allowedChoices = [...options, ...(question.allowOther ? ["Other"] : [])];
    if (selected.some((value) => !allowedChoices.includes(value))) return false;
    if (question.min && count < question.min) return false;
    if (question.required && count === 0) return false;
    if (question.allowOther && selected.includes("Other") && !otherValue.trim()) return false;
    return true;
  }

  function next() {
    if (step < stage.questions.length - 1) setStep((current) => current + 1);
    else onSave(draft);
  }

  const countGuidance = question.type === "multi"
    ? question.min === question.max && question.min
      ? `Choose exactly ${question.min}.`
      : question.max
        ? `Choose up to ${question.max}.`
        : "Choose all that apply."
    : question.type === "single"
      ? "Choose one."
      : question.id === "strength_story"
        ? "What happened? What did you do? Why are you proud of it?"
        : "Take a moment and answer in your own words.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="activity-dialog">
        <DialogHeader>
          <div className="activity-meta"><p className="activity-kicker">DISCOVERY • {stage.label.toUpperCase()}</p><span>{step + 1} of {stage.questions.length}</span></div>
          <DialogTitle>{stage.prompt}</DialogTitle>
          <DialogDescription>{step === 0 ? stage.intro : countGuidance}</DialogDescription>
        </DialogHeader>
        <Progress className="activity-progress" value={((step + 1) / stage.questions.length) * 100} aria-label={`Question ${step + 1} of ${stage.questions.length}`} />
        {step === 0 && explorationThemes.length ? <aside className="exploration-bridge"><Sparkles /><div><strong>Your exploration gave you a starting point</strong><p>You noticed: {explorationThemes.join(" • ")}. Keep, change, or ignore these ideas as you answer—your reflection is still yours.</p></div></aside> : null}
        <section className="question-panel" aria-labelledby={`question-${question.id}`}>
          <div className="question-heading">
            <span>QUESTION {step + 1}</span>
            <h3 id={`question-${question.id}`}>{question.prompt}</h3>
            <p>{countGuidance}{question.required || question.min ? " Required." : " Optional."}</p>
          </div>

          {question.type === "text" ? (
            <Textarea
              className={`reflection-textarea ${question.long ? "is-long" : ""}`}
              value={typeof rawValue === "string" ? rawValue : ""}
              onChange={(event) => setDraft((current) => ({ ...current, [question.id]: event.target.value }))}
              placeholder="Type your response here…"
              autoFocus
            />
          ) : (
            <div className={`selection-grid ${question.type === "single" ? "is-single" : ""}`}>
              {[...options, ...(question.allowOther ? ["Other"] : [])].map((option) => {
                const active = selected.includes(option);
                return (
                  <button key={option} type="button" aria-pressed={active} className={active ? "selected" : ""} onClick={() => toggle(option)}>
                    <span>{active ? <Check /> : null}</span>{option}
                  </button>
                );
              })}
            </div>
          )}

          {question.allowOther && selected.includes("Other") ? (
            <div className="other-response">
              <label htmlFor={`other-${question.id}`}>Tell us what you would add</label>
              <Input id={`other-${question.id}`} value={otherValue} onChange={(event) => setDraft((current) => ({ ...current, [otherKey]: event.target.value }))} placeholder="Your answer" />
            </div>
          ) : null}

          {question.type !== "text" ? (
            <div className="selection-status">
              <span>{selected.length} selected{question.max ? ` • ${question.max} max` : ""}</span>
              <span>{step === stage.questions.length - 1 ? "+100 XP" : "Reflection in progress"}</span>
            </div>
          ) : null}
        </section>
        <DialogFooter className="activity-actions">
          <Button variant="ghost" onClick={() => step === 0 ? onOpenChange(false) : setStep((current) => current - 1)}>{step === 0 ? "Not yet" : <><ArrowLeft /> Back</>}</Button>
          <Button disabled={!isValid()} onClick={next}>{step === stage.questions.length - 1 ? "Save activity" : "Next question"} <ChevronRight /></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function responseText(response: ActivityResponse, question: Question) {
  const raw = response[question.id];
  if (!raw || (Array.isArray(raw) && !raw.length)) return "Not answered yet";
  const values = Array.isArray(raw) ? raw : [raw];
  const other = response[`${question.id}__other`];
  return values.map((value) => value === "Other" && typeof other === "string" && other.trim() ? other.trim() : value).join(" • ");
}

function CoachSummaryDialog({ open, onOpenChange, journey }: { open: boolean; onOpenChange: (open: boolean) => void; journey: SavedJourney }) {
  const proudStrength = answerText(journey, "strengths", "proudest_strength");
  const guidingValue = answerText(journey, "values", "brightest_star");
  const purpose = answerText(journey, "purpose", "purpose_statement");
  const goal = answerText(journey, "nextQuest", "goal");
  const support = answerText(journey, "support", "biggest_difference");
  const exploredStrengths = STRENGTH_LENS.filter((item) => journey.exploredStrengths.includes(item.id)).map((item) => item.title);
  const exploredThemes = Object.entries(journey.explorationSelections).flatMap(([slide, themes]) => themes.map((theme) => ({ scene: SCENES.find((item) => item.slide === Number(slide))?.title ?? `Scene ${slide}`, theme })));
  const complete = journey.completed.length === STAGES.length;
  const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(journey.completionDate ? new Date(journey.completionDate) : new Date());
  const alignment = [
    proudStrength ? `${journey.name} identified ${proudStrength} as a strength they are proud of.` : "Strength reflection is still in progress.",
    guidingValue ? `${guidingValue} emerged as their brightest guiding value.` : "A brightest guiding value has not been selected yet.",
    purpose ? `Their purpose response centered on: ${purpose}` : "Purpose reflection is still in progress.",
    goal ? `They chose ${goal} as their next quest.` : "A next quest has not been selected yet.",
  ].join(" ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="coach-summary-dialog">
        <DialogHeader className="coach-summary-header">
          <div><p className="activity-kicker">LEVEL UP • DISCOVERY</p><DialogTitle>Discovery Coach Snapshot</DialogTitle><DialogDescription>A participant-owned conversation guide for reviewing discoveries, connections, and next steps.</DialogDescription></div>
          <div className="summary-identity"><strong>{journey.name || "Participant"}</strong><span>{complete ? "Discovery complete" : `${journey.completed.length} of ${STAGES.length} activities complete`} • {journey.completed.length * 100} XP</span><span>{date}</span></div>
        </DialogHeader>

        <section className="alignment-summary"><span><Sparkles /> ALIGNMENT SNAPSHOT</span><p>{alignment}</p>{support ? <p><strong>Support priority:</strong> {support}</p> : null}</section>

        <section className="summary-exploration">
          <h3>What the participant explored</h3>
          <div className="summary-exploration-grid">
            <article><strong>Strength Lens</strong><span>{exploredStrengths.length} of {STRENGTH_LENS.length} scenes explored</span><p>{exploredStrengths.length ? exploredStrengths.join(" • ") : "No Strength Lens scenes selected yet."}</p></article>
            <article><strong>Discovery themes</strong><span>{exploredThemes.length} themes noticed</span><p>{exploredThemes.length ? exploredThemes.map((item) => item.theme).join(" • ") : "No optional exploration themes selected yet."}</p></article>
          </div>
        </section>

        <section className="summary-activities">
          <h3>Reflection responses</h3>
          {ACTIVITIES.map((activity) => <article key={activity.id} className="summary-activity">
            <header><div><span>{journey.completed.includes(activity.id) ? <Check /> : activity.label.slice(0, 1)}</span><strong>{activity.label}</strong></div><b>{journey.completed.includes(activity.id) ? "Complete" : "In progress"}</b></header>
            <dl>{activity.questions.map((question) => <div key={question.id}><dt>{question.prompt}</dt><dd>{responseText(journey.answers[activity.id], question)}</dd></div>)}</dl>
          </article>)}
        </section>

        <section className="coach-prompts"><h3>Conversation starters</h3><ol><li>Which discovery feels most accurate or important to you right now?</li><li>Where have you already used these strengths or values in school, work, family, or community life?</li><li>How does your next quest connect with what matters to you and the future you described?</li><li>What support would make the next step more realistic, and who could help provide it?</li></ol></section>

        <p className="summary-note">This snapshot reflects the participant&apos;s own selections and words. Use it to guide a conversation—not as a test result or fixed career prescription.</p>
        <DialogFooter className="coach-summary-actions"><Button variant="outline" onClick={() => onOpenChange(false)}>Return to Discovery</Button><Button onClick={() => window.print()}><Printer /> Save as PDF / Print</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JourneyMap({ name, onCertificate, onSummary, onReview }: { name: string; onCertificate: () => void; onSummary: () => void; onReview: () => void }) {
  return (
    <div className="map-view">
      <div className="map-complete-card">
        <div className="completion-icon"><Trophy /></div>
        <p>500 XP • DISCOVERY COMPLETE</p>
        <h1>Way to level up, {name}.</h1>
        <span>Resume District is now unlocked.</span>
        <div className="map-actions"><Button onClick={onSummary}><ClipboardList /> Coach snapshot</Button><Button variant="outline" onClick={onCertificate}><Trophy /> Certificate</Button><Button variant="outline" onClick={onReview}><ArrowLeft /> Review</Button></div>
      </div>
      <button className="resume-district-hotspot" onClick={() => toast("Resume District will connect here next.")}><span className="hotspot-ring" /><span className="hotspot-label"><Sparkles /> Resume District unlocked</span></button>
    </div>
  );
}
