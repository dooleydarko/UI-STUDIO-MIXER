/**
 * Engine Foundry & Model Library Schema
 * Replicates the UI Component Library architecture specifically for AI Engines & Proxies.
 */

export type EngineCategory = 
  | 'code_generation' 
  | 'reasoning' 
  | 'video_diffusion' 
  | 'local_webgpu' 
  | 'universal_proxy'
  | 'hybrid_pipeline';

export type EngineCostTier = 'free_unmetered' | 'pooled_cloud' | 'local_device';

export interface EnginePackage {
  id: string;
  name: string;
  version: string;
  category: EngineCategory;
  costTier: EngineCostTier;
  description: string;
  latencyEstimateMs: number;
  tokenQuota: string;
  endpointUrl: string;
  schemaProtocol: 'anthropic' | 'openai' | 'webgpu' | 'custom_proxy';
  tags: string[];
  status: 'online' | 'ready' | 'standby';
  systemPrompt?: string;
  samplePrompt: string;
  benchmarkScore?: string;
  author: string;
  emblemUrl?: string;
  emblemSvg?: string;
  canvasX?: number;
  canvasY?: number;
}

export interface HybridEngineMix {
  id: string;
  name: string;
  primaryEngineId: string;
  secondaryEngineId: string;
  fallbackEngineId?: string;
  synthesizedPurpose: string;
  createdAt: number;
}

export const STARTER_ENGINES_CATALOG: EnginePackage[] = [
  {
    id: 'eng-freellm-gateway',
    name: 'FreeLLM 7.4B Universal Gateway',
    version: '1.2.0',
    category: 'universal_proxy',
    costTier: 'free_unmetered',
    description: 'Centralized local proxy pooling 7.4 billion monthly free tokens across 34 providers with auto-failover.',
    latencyEstimateMs: 45,
    tokenQuota: '7.4B Tokens / Month ($0)',
    endpointUrl: 'http://localhost:3001/v1',
    schemaProtocol: 'custom_proxy',
    tags: ['Proxy', 'Auto-Failover', '34 Providers', 'Zero-Cost'],
    status: 'online',
    samplePrompt: 'Synthesize a high-performance interactive dashboard with Tailwind CSS.',
    benchmarkScore: '100% Up-time Cascade',
    author: 'Antigravity Core',
  },
  {
    id: 'eng-claude-sonnet-emul',
    name: 'Claude 3.5 / 5.5 High Sonnet Core',
    version: '2024-10-22',
    category: 'code_generation',
    costTier: 'pooled_cloud',
    description: 'Gold-standard agentic coding engine emulating Claude Sonnet via Anthropic SSE messages streaming.',
    latencyEstimateMs: 180,
    tokenQuota: 'Pooled Unmetered Allowance',
    endpointUrl: 'http://localhost:3001/v1/messages',
    schemaProtocol: 'anthropic',
    tags: ['Claude Code', 'Agentic Pair', 'SSE Stream', 'Multi-File'],
    status: 'online',
    samplePrompt: 'Refactor complex state machines across multiple React components.',
    benchmarkScore: '93.7% Agentic Score',
    author: 'Anthropic Compatible',
  },
  {
    id: 'eng-qwen-coder-32b',
    name: 'Qwen 2.5 Coder (32B Deep Power)',
    version: '2.5.32b',
    category: 'code_generation',
    costTier: 'free_unmetered',
    description: 'Premier open-weights coding model scoring 92.7% on HumanEval, beating proprietary models on frontend and full-stack code.',
    latencyEstimateMs: 120,
    tokenQuota: '100% Free Open Weights',
    endpointUrl: 'http://localhost:3001/v1/chat/completions',
    schemaProtocol: 'openai',
    tags: ['Top Coding', 'Apache 2.0', 'HumanEval 92.7%', 'Full-Stack'],
    status: 'online',
    samplePrompt: 'Write a zero-dependency WebGL particle fluid simulator.',
    benchmarkScore: 'HumanEval: 92.7%',
    author: 'Alibaba Cloud & OpenWeights',
  },
  {
    id: 'eng-llama33-70b-groq',
    name: 'Groq Llama 3.3 70B (300 t/s LPU)',
    version: '3.3-70b',
    category: 'reasoning',
    costTier: 'free_unmetered',
    description: 'Blistering 300+ tokens-per-second inference on Groq Language Processing Units for instant code inspection and planning.',
    latencyEstimateMs: 25,
    tokenQuota: 'Free Tier Groq LPU Quota',
    endpointUrl: 'http://localhost:3001/v1/chat/completions',
    schemaProtocol: 'openai',
    tags: ['Ultra Fast', '300 t/s', 'Groq LPUs', 'Meta Llama'],
    status: 'online',
    samplePrompt: 'Analyze this algorithm for time complexity and memory bottlenecks.',
    benchmarkScore: '300 Tokens / Sec',
    author: 'Meta & Groq',
  },
  {
    id: 'eng-deepseek-r1',
    name: 'DeepSeek R1 / V3 Reasoning Core',
    version: 'r1-671b',
    category: 'reasoning',
    costTier: 'free_unmetered',
    description: '671B Mixture-of-Experts reasoning powerhouse matching OpenAI o1 on competitive programming and mathematical proofs.',
    latencyEstimateMs: 240,
    tokenQuota: '100% Free / MIT Open Source',
    endpointUrl: 'http://localhost:3001/v1/chat/completions',
    schemaProtocol: 'openai',
    tags: ['Chain-of-Thought', 'MoE 671B', 'Deep Math', 'MIT License'],
    status: 'online',
    samplePrompt: 'Derive a mathematically optimal collision detection bounding tree for 3D meshes.',
    benchmarkScore: 'o1-Equivalent Logic',
    author: 'DeepSeek AI',
  },
  {
    id: 'eng-omnivideo-proxy',
    name: 'OmniVideo Multi-Account Proxy',
    version: '2.0.0',
    category: 'video_diffusion',
    costTier: 'free_unmetered',
    description: 'Stealth session rotator for Higgsfield Soul, Runway Gen-3, and Hugging Face Zero-GPU community A100 tiers.',
    latencyEstimateMs: 1400,
    tokenQuota: 'Pooled Account Credits & Zero-GPU',
    endpointUrl: 'http://localhost:3002/v1/video/generations',
    schemaProtocol: 'custom_proxy',
    tags: ['Video Diffusion', 'Higgsfield', 'Runway', 'Zero-GPU'],
    status: 'online',
    samplePrompt: 'Cinematic hyperlapse of iridescent liquid chrome flowing over a carbon fiber chassis.',
    benchmarkScore: 'Multi-Cluster Failover',
    author: 'Antigravity Studio',
  },
  {
    id: 'eng-webgpu-shaders',
    name: 'On-Device WebGPU Compute Shaders',
    version: '1.0.0',
    category: 'local_webgpu',
    costTier: 'local_device',
    description: '100% offline neural compute running directly on your Intel Mac GPU shaders inside Chrome with zero servers or APIs.',
    latencyEstimateMs: 15,
    tokenQuota: '$0 / No Cloud / 100% Offline',
    endpointUrl: 'webgpu://local-device-shader',
    schemaProtocol: 'webgpu',
    tags: ['Offline', 'WebGPU', 'Intel Iris Plus', 'Zero Bandwidth'],
    status: 'online',
    samplePrompt: 'Render procedural normal maps and liquid glass refraction.',
    benchmarkScore: '60 FPS Direct GPU',
    author: 'Antigravity Shaders',
  },
  {
    id: 'eng-gemini-flash-multimodal',
    name: 'Google Gemini 2.0 Flash Multimodal',
    version: '2.0.0',
    category: 'reasoning',
    costTier: 'free_unmetered',
    description: '1,000,000 token multimodal context window with sub-300ms speed for instant visual UI code transcription.',
    latencyEstimateMs: 35,
    tokenQuota: '15 RPM Free Cloud Tier',
    endpointUrl: 'https://generativelanguage.googleapis.com',
    schemaProtocol: 'openai',
    tags: ['1M Context', 'Multimodal', 'Vision', 'Google AI'],
    status: 'online',
    samplePrompt: 'Convert this uploaded UI screenshot into pixel-perfect responsive Tailwind JSX.',
    benchmarkScore: '1,000,000 Tokens',
    author: 'Google AI Studio',
  },
];
