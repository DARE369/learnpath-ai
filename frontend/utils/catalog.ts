export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface CatalogCourse {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  category: string;
  difficulty: Difficulty;
  durationMinutes: number;
  videoCount: number;
  studentCount: number;
  rating: number;
  ratingCount: number;
  instructor: string;
  prerequisites: string[];
  syllabus: { title: string; minutes: number }[];
  reviews: { author: string; rating: number; comment: string }[];
}

export const CATALOG: CatalogCourse[] = [
  {
    id: "photosynthesis-101",
    title: "Photosynthesis: From Light to Glucose",
    description: "How plants turn sunlight into chemical energy — the chemistry, biology, and elegance.",
    longDescription:
      "A guided path through one of biology's most important reactions. You will follow electrons through chlorophyll, watch ATP and NADPH being built, and end at the Calvin cycle producing glucose. Designed for curious learners with no prior chemistry background.",
    category: "Biology",
    difficulty: "beginner",
    durationMinutes: 95,
    videoCount: 6,
    studentCount: 2384,
    rating: 4.8,
    ratingCount: 412,
    instructor: "Curated from top YouTube creators",
    prerequisites: [],
    syllabus: [
      { title: "What is photosynthesis?", minutes: 12 },
      { title: "Chlorophyll and the light reactions", minutes: 18 },
      { title: "ATP and NADPH explained", minutes: 16 },
      { title: "The Calvin cycle", minutes: 17 },
      { title: "C3, C4 and CAM plants", minutes: 14 },
      { title: "Photosynthesis in the wider ecosystem", minutes: 18 },
    ],
    reviews: [
      { author: "Aisha", rating: 5, comment: "The path order was perfect — each video built on the last." },
      { author: "Marcus", rating: 5, comment: "I finally understand the Calvin cycle. Thank you." },
      { author: "Priya", rating: 4, comment: "Great curation. Wish there was one more video on light wavelengths." },
    ],
  },
  {
    id: "neural-networks-foundations",
    title: "Neural Networks: Foundations",
    description: "Build intuition for how neural networks learn — from the perceptron to backprop.",
    longDescription:
      "A first principles tour of neural networks. Start with a single neuron, build up to multilayer networks, and watch gradient descent in action. Math is introduced gradually with visual explanations.",
    category: "Machine Learning",
    difficulty: "intermediate",
    durationMinutes: 140,
    videoCount: 8,
    studentCount: 4127,
    rating: 4.9,
    ratingCount: 891,
    instructor: "Curated from top YouTube creators",
    prerequisites: ["Comfort with basic algebra", "Some Python helpful but not required"],
    syllabus: [
      { title: "The perceptron", minutes: 15 },
      { title: "Activation functions intuited", minutes: 12 },
      { title: "From one neuron to a network", minutes: 18 },
      { title: "Forward propagation step by step", minutes: 16 },
      { title: "The loss landscape", minutes: 14 },
      { title: "Backpropagation visualized", minutes: 22 },
      { title: "Gradient descent and learning rate", minutes: 20 },
      { title: "Putting it all together", minutes: 23 },
    ],
    reviews: [
      { author: "Daniel", rating: 5, comment: "Best backprop explanation I've seen." },
      { author: "Sophia", rating: 5, comment: "I went from confused to confident in a weekend." },
    ],
  },
  {
    id: "transformers-from-scratch",
    title: "Transformers from Scratch",
    description: "Self-attention, positional encoding, and why this architecture changed everything.",
    longDescription:
      "Go deep on the architecture behind every modern LLM. We build a small transformer from scratch and watch attention weights light up. Heavy on intuition, light on tedious math.",
    category: "Machine Learning",
    difficulty: "advanced",
    durationMinutes: 210,
    videoCount: 10,
    studentCount: 1942,
    rating: 4.9,
    ratingCount: 524,
    instructor: "Curated from top YouTube creators",
    prerequisites: ["Neural Networks: Foundations or equivalent", "Python and NumPy familiarity"],
    syllabus: [
      { title: "Why attention?", minutes: 16 },
      { title: "Scaled dot-product attention", minutes: 22 },
      { title: "Multi-head attention", minutes: 20 },
      { title: "Positional encodings", minutes: 18 },
      { title: "Encoder block walkthrough", minutes: 24 },
      { title: "Decoder block walkthrough", minutes: 24 },
      { title: "Training a tiny transformer", minutes: 22 },
      { title: "Visualizing attention", minutes: 18 },
      { title: "Scaling laws", minutes: 22 },
      { title: "From transformers to LLMs", minutes: 24 },
    ],
    reviews: [
      { author: "Rina", rating: 5, comment: "Finally I get what's happening inside an LLM." },
      { author: "James", rating: 5, comment: "The attention visualizations made it click." },
    ],
  },
  {
    id: "calculus-intuition",
    title: "Calculus, Intuitively",
    description: "Derivatives and integrals explained the way they should have been taught the first time.",
    longDescription:
      "If you survived calculus but never really got it, this is the path. Geometric and physical intuition come first, formulas come second.",
    category: "Math",
    difficulty: "beginner",
    durationMinutes: 165,
    videoCount: 9,
    studentCount: 5621,
    rating: 4.8,
    ratingCount: 1203,
    instructor: "Curated from top YouTube creators",
    prerequisites: ["High school algebra"],
    syllabus: [
      { title: "What is a derivative, really?", minutes: 18 },
      { title: "The chain rule visualized", minutes: 16 },
      { title: "Integrals as accumulation", minutes: 20 },
      { title: "The fundamental theorem", minutes: 18 },
      { title: "Why e^x is special", minutes: 16 },
      { title: "Series and approximation", minutes: 20 },
      { title: "Multivariable preview", minutes: 18 },
      { title: "Vectors and motion", minutes: 18 },
      { title: "Where calculus shows up", minutes: 21 },
    ],
    reviews: [
      { author: "Tomás", rating: 5, comment: "I wish I had this in high school." },
    ],
  },
  {
    id: "react-modern-patterns",
    title: "Modern React Patterns",
    description: "Hooks, context, suspense, and the patterns top React teams actually use today.",
    longDescription:
      "A pragmatic path through real-world React patterns. We skip the basics and focus on what makes production codebases maintainable.",
    category: "Web Development",
    difficulty: "intermediate",
    durationMinutes: 180,
    videoCount: 9,
    studentCount: 3318,
    rating: 4.7,
    ratingCount: 712,
    instructor: "Curated from top YouTube creators",
    prerequisites: ["Comfortable with React fundamentals"],
    syllabus: [
      { title: "Hooks deep dive", minutes: 20 },
      { title: "Context done right", minutes: 18 },
      { title: "Compound components", minutes: 22 },
      { title: "Server components explained", minutes: 24 },
      { title: "Suspense and streaming", minutes: 20 },
      { title: "Forms without pain", minutes: 18 },
      { title: "Testing patterns", minutes: 18 },
      { title: "Performance profiling", minutes: 20 },
      { title: "Real-world project review", minutes: 20 },
    ],
    reviews: [
      { author: "Lina", rating: 5, comment: "Server components finally make sense." },
    ],
  },
  {
    id: "system-design-essentials",
    title: "System Design Essentials",
    description: "Load balancers, caching, queues, sharding — explained for engineers who build things.",
    longDescription:
      "A focused tour of the building blocks behind every large-scale system. Each lesson uses a real-world case study to ground the concept.",
    category: "Engineering",
    difficulty: "advanced",
    durationMinutes: 220,
    videoCount: 11,
    studentCount: 6204,
    rating: 4.9,
    ratingCount: 1518,
    instructor: "Curated from top YouTube creators",
    prerequisites: ["Backend experience helpful"],
    syllabus: [
      { title: "Scaling fundamentals", minutes: 18 },
      { title: "Load balancers", minutes: 20 },
      { title: "Caching strategies", minutes: 22 },
      { title: "Databases at scale", minutes: 24 },
      { title: "Sharding and partitioning", minutes: 22 },
      { title: "Message queues", minutes: 20 },
      { title: "CDNs and edge", minutes: 18 },
      { title: "Consistency and CAP", minutes: 20 },
      { title: "Designing Twitter", minutes: 18 },
      { title: "Designing a URL shortener", minutes: 18 },
      { title: "Designing a video platform", minutes: 20 },
    ],
    reviews: [
      { author: "Ben", rating: 5, comment: "Cleared up everything I struggled with in interviews." },
      { author: "Aditi", rating: 5, comment: "The case studies make it stick." },
    ],
  },
];

export function getCourse(id: string | undefined): CatalogCourse | undefined {
  if (!id) return undefined;
  return CATALOG.find((c) => c.id === id);
}
