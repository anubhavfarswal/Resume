import { Project, Education, Certificate } from './types';

export const RESUME_DATA = {
  name: "Anubhav Kumar",
  title: "M.Tech | AI Researcher & Frontend Engineer",
  email: "anubhavfarswal@gmail.com",
  phone: "6398011321",
  location: "New Delhi, Delhi, 110045, IN",
  linkedin: "Anubhav Kumar",
  summary: "M.Tech candidate at Bennett University bridging Machine Learning research with Front-End development. I specialize in integrating complex Transformer models into responsive web interfaces, creating seamless, end-to-end applications that make advanced data intelligence accessible and user-friendly.",
};

export const PROJECTS: Project[] = [
  {
    title: "High-Precision Textual Verification System",
    type: "AI / BERT-Family Models",
    description: "Designed a high-precision verification system leveraging BERT, ROBERTa, and DeBERTa for advanced text classification. Integrated these Transformer models into a responsive front-end interface, enabling real-time credibility assessment and seamless user interaction.",
    tech: ["BERT", "ROBERTa", "Python", "React", "ML"]
  },
  {
    title: "End-to-End Neural Text Analytics Platform",
    type: "Full Stack / Real-Time UI",
    description: "Developed an end-to-end platform using BERT and ROBERTa for advanced text analytics. Engineered a real-time, responsive UI to visualize model insights, effectively bridging complex ML back ends with intuitive front-end design.",
    tech: ["Neural Networks", "Data Viz", "TypeScript", "UI/UX"]
  },
  {
    title: "Cross-Platform Component Library",
    type: "Frontend Infrastructure",
    description: "Developed a library of reusable, responsive UI components optimized for high-volume data visualization. Built to ensure seamless performance across platforms, providing a consistent interface for complex analytical outputs.",
    tech: ["React", "Component Lib", "Performance", "Design System"]
  }
];

export const EDUCATION_HISTORY: Education[] = [
  {
    degree: "Master of Technology (M.Tech)",
    school: "Bennett University",
    year: "08/2024 – Present",
    score: "GPA: 7.74",
    details: [
      "Specialization in Computer Science Engineering",
      "Research focus: Neural Networks & Transformer Models",
      "Advanced AI Algorithms & Implementation"
    ]
  },
  {
    degree: "Master of Computer Applications",
    school: "Chandigarh University",
    year: "2022 – 2024",
    score: "GPA: 6.91",
    details: [
      "Core Computing & Software Architectures",
      "Full Stack Development Methodologies",
      "Cloud Computing & Database Systems"
    ]
  },
  {
    degree: "B.Sc. in Computer Science (Honours)",
    school: "Meerut college",
    year: "2018 – 2021",
    score: "GPA: 6.14",
    details: [
      "Foundations of Computer Science",
      "Data Structures & Algorithms Analysis",
      "System Programming & OS Concepts"
    ]
  }
];

export const CERTIFICATES: Certificate[] = [
  { name: "Digital Image & Video Processing", icon: "image" },
  { name: "Generative AI: Intro & Applications", icon: "psychology" },
  { name: "Databases & SQL for Data Science", icon: "database" },
  { name: "Computer Networks Security", icon: "security" },
  { name: "NLP with Classification", icon: "translate" },
  { name: "Python Data Structures", icon: "code" }
];

// Ordered for visual grouping in Radar Chart (AI -> System -> Backend -> Frontend)
export const SKILL_METRICS = [
  { subject: 'Python (AI)', A: 95, fullMark: 100 },
  { subject: 'C++', A: 80, fullMark: 100 },
  { subject: 'Java', A: 75, fullMark: 100 },
  { subject: 'Node.js', A: 85, fullMark: 100 },
  { subject: 'JS / TS', A: 90, fullMark: 100 },
  { subject: 'React / Next', A: 92, fullMark: 100 },
  { subject: 'HTML / CSS', A: 95, fullMark: 100 },
  { subject: 'Dart', A: 70, fullMark: 100 },
  { subject: 'Git', A: 88, fullMark: 100 },
];

export const CORE_SKILLS = SKILL_METRICS.map(s => s.subject);

export const INTERESTS = [
  "AI Research",
  "UI/UX Trends",
  "Strategic Gaming",
  "Open-Source",
  "Traveling"
];
