export interface ParameterInfo {
  name: string;
  type: string;
  hasDefaultValue?: boolean;
  defaultValue?: string | null;
}

export interface MethodInfo {
  name: string;
  returnType: string;
  parameters: ParameterInfo[];
  modifiers: string;
  isPublic: boolean;
  body?: string;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  filePath: string;
  methods: MethodInfo[];
}

export interface ControllerInfo {
  name: string;
  namespace: string;
  filePath: string;
  routePrefix: string;
  methods: MethodInfo[];
}

export interface TestScenario {
  name: string;
  description: string;
  category: string;
  inputSummary: string;
  expectedBehavior: string;
  methodName: string;
}

export interface GeneratedTest {
  className: string;
  targetClass: string;
  testType: string;
  testCode: string;
  scenarios: TestScenario[];
  status: 'Pending' | 'Passed' | 'Failed' | 'Skipped';
  errorMessage?: string | null;
}

export interface AnalysisResult {
  sessionId: string;
  projectType: string;
  projectName: string;
  services: ServiceInfo[];
  controllers: ControllerInfo[];
  totalMethods: number;
  testsGenerated: number;
  tests: GeneratedTest[];
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

export interface TestClassDetail {
  className: string;
  status: string;
  errorMessage: string | null;
  scenarioCount: number;
}

export interface TestResults {
  sessionId: string;
  summary: TestSummary;
  details: TestClassDetail[];
}

export interface ProjectTypeOption {
  id: 'DotNet' | 'Node' | 'Spring';
  label: string;
  icon: React.ReactNode;
  desc: string;
  files: string;
  color: string;
}
