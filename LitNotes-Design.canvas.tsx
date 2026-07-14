import {
  H1,
  H2,
  H3,
  Text,
  Stack,
  Row,
  Grid,
  Card,
  CardHeader,
  CardBody,
  Divider,
  Pill,
  Callout,
  Table,
  Code,
  Stat,
  useHostTheme,
  computeDAGLayout,
} from 'cursor/canvas';

/* ------------------------------------------------------------------ */
/* Shared diagram primitives                                           */
/* ------------------------------------------------------------------ */

type NodeKind = 'terminal' | 'screen' | 'process' | 'store' | 'key' | 'external';
type FlowNode = { id: string; label: string; kind?: NodeKind };
type FlowEdge = { from: string; to: string; label?: string };

function nodeById(nodes: FlowNode[], id: string): FlowNode | undefined {
  for (const n of nodes) if (n.id === id) return n;
  return undefined;
}

function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function nodeColors(theme: ReturnType<typeof useHostTheme>, kind?: NodeKind) {
  const base = {
    fill: theme.bg.elevated,
    stroke: theme.stroke.primary,
    text: theme.text.primary,
    sw: 1.2,
    fw: 500 as number,
  };
  switch (kind) {
    case 'terminal':
      return { ...base, stroke: theme.accent.primary, sw: 1.8, text: theme.accent.primary, fw: 600 };
    case 'key':
      return { ...base, stroke: theme.accent.primary, sw: 1.8, fw: 600 };
    case 'store':
      return { ...base, fill: theme.fill.tertiary, stroke: theme.stroke.secondary };
    case 'process':
      return { ...base, fill: theme.fill.secondary };
    case 'external':
      return { ...base, stroke: theme.stroke.secondary, fw: 600 };
    default:
      return base;
  }
}

function edgePath(
  e: { sourceX: number; sourceY: number; targetX: number; targetY: number },
  direction: 'vertical' | 'horizontal',
): string {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = e;
  if (direction === 'vertical') {
    const c = (ty - sy) * 0.5;
    return `M${sx},${sy} C${sx},${sy + c} ${tx},${ty - c} ${tx},${ty}`;
  }
  const c = (tx - sx) * 0.5;
  return `M${sx},${sy} C${sx + c},${sy} ${tx - c},${ty} ${tx},${ty}`;
}

function FlowGraph({
  id,
  nodes,
  edges,
  direction = 'vertical',
  nodeWidth = 190,
  nodeHeight = 54,
  rankGap,
  nodeGap = 38,
}: {
  id: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction?: 'vertical' | 'horizontal';
  nodeWidth?: number;
  nodeHeight?: number;
  rankGap?: number;
  nodeGap?: number;
}) {
  const theme = useHostTheme();
  const layout = computeDAGLayout({
    nodes: nodes.map((n) => ({ id: n.id })),
    edges: edges.map((e) => ({ from: e.from, to: e.to })),
    direction,
    nodeWidth,
    nodeHeight,
    rankGap: rankGap ?? (direction === 'vertical' ? 60 : 150),
    nodeGap,
    padding: 20,
  });
  const arrow = theme.text.tertiary;
  const mid = `arw-${id}`;
  const maxChars = Math.floor((nodeWidth - 18) / 6.2);

  const labelByPair = (from: string, to: string) =>
    edges.find((e) => e.from === from && e.to === to)?.label;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <svg width={layout.width} height={layout.height} style={{ display: 'block' }}>
        <defs>
          <marker id={mid} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={arrow} />
          </marker>
        </defs>

        {layout.edges.map((e, i) => (
          <path
            key={`e-${i}`}
            d={edgePath(e, direction)}
            fill="none"
            stroke={arrow}
            strokeWidth={1.4}
            strokeDasharray={e.isBackEdge ? '5 4' : undefined}
            markerEnd={`url(#${mid})`}
          />
        ))}

        {layout.edges.map((e, i) => {
          const lbl = labelByPair(e.from, e.to);
          if (!lbl) return null;
          const mx = (e.sourceX + e.targetX) / 2;
          const my = (e.sourceY + e.targetY) / 2;
          const w = lbl.length * 5.7 + 8;
          return (
            <g key={`l-${i}`}>
              <rect x={mx - w / 2} y={my - 8} width={w} height={15} rx={4} fill={theme.bg.editor} />
              <text
                x={mx}
                y={my + 3}
                textAnchor="middle"
                fontSize={10}
                fill={theme.text.secondary}
                fontFamily="system-ui, sans-serif">
                {lbl}
              </text>
            </g>
          );
        })}

        {layout.nodes.map((ln) => {
          const meta = nodeById(nodes, ln.id);
          const c = nodeColors(theme, meta?.kind);
          const lines = wrapLabel(meta?.label ?? ln.id, maxChars);
          const cx = ln.x + nodeWidth / 2;
          const cy = ln.y + nodeHeight / 2;
          const startY = cy - (lines.length - 1) * 7 + 4;
          return (
            <g key={ln.id}>
              <rect
                x={ln.x}
                y={ln.y}
                width={nodeWidth}
                height={nodeHeight}
                rx={12}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth={c.sw}
                strokeDasharray={meta?.kind === 'store' ? '5 4' : undefined}
              />
              <text
                x={cx}
                y={startY}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={c.fw}
                fill={c.text}
                fontFamily="system-ui, sans-serif">
                {lines.map((l, i) => (
                  <tspan key={i} x={cx} dy={i === 0 ? 0 : 14}>
                    {l}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type SeqMsg = { from: number; to: number; label: string; dashed?: boolean };

function SequenceDiagram({
  id,
  actors,
  messages,
}: {
  id: string;
  actors: string[];
  messages: SeqMsg[];
}) {
  const theme = useHostTheme();
  const col = 156;
  const leftPad = 14;
  const headY = 8;
  const headH = 36;
  const firstMsg = headY + headH + 34;
  const msgGap = 44;
  const width = leftPad * 2 + actors.length * col;
  const height = firstMsg + messages.length * msgGap + 20;
  const ax = (i: number) => leftPad + i * col + col / 2;
  const mid = `sarw-${id}`;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <marker id={mid} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill={theme.text.tertiary} />
          </marker>
        </defs>

        {actors.map((a, i) => (
          <g key={a}>
            <line
              x1={ax(i)}
              y1={headY + headH}
              x2={ax(i)}
              y2={height - 12}
              stroke={theme.stroke.secondary}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <rect
              x={ax(i) - col / 2 + 10}
              y={headY}
              width={col - 20}
              height={headH}
              rx={9}
              fill={theme.fill.secondary}
              stroke={theme.stroke.primary}
              strokeWidth={1}
            />
            <text
              x={ax(i)}
              y={headY + headH / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={theme.text.primary}
              fontFamily="system-ui, sans-serif">
              {a}
            </text>
          </g>
        ))}

        {messages.map((m, i) => {
          const y = firstMsg + i * msgGap;
          const x1 = ax(m.from);
          const x2 = ax(m.to);
          const midX = (x1 + x2) / 2;
          return (
            <g key={`m-${i}`}>
              <text
                x={midX}
                y={y - 7}
                textAnchor="middle"
                fontSize={10.5}
                fill={theme.text.secondary}
                fontFamily="system-ui, sans-serif">
                {`${i + 1}. ${m.label}`}
              </text>
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={theme.text.tertiary}
                strokeWidth={1.4}
                strokeDasharray={m.dashed ? '5 4' : undefined}
                markerEnd={`url(#${mid})`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LegendDot({ label, color, dashed }: { label: string; color: string; dashed?: boolean }) {
  return (
    <Row gap={6} align="center">
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: `1.6px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }}
      />
      <Text size="small" tone="secondary">
        {label}
      </Text>
    </Row>
  );
}

/* ------------------------------------------------------------------ */
/* Diagram data                                                        */
/* ------------------------------------------------------------------ */

const userFlow: { nodes: FlowNode[]; edges: FlowEdge[] } = {
  nodes: [
    { id: 'splash', label: 'Splash screen', kind: 'terminal' },
    { id: 'auth', label: 'Sign in / Sign up', kind: 'screen' },
    { id: 'google', label: 'Google / cloud login', kind: 'external' },
    { id: 'perms', label: 'Permission requests', kind: 'process' },
    { id: 'onboard', label: 'First-run onboarding', kind: 'screen' },
    { id: 'home', label: 'Workspace', kind: 'key' },
    { id: 'open', label: 'Open judgment / sample' },
    { id: 'read', label: 'Read + highlight PDF' },
    { id: 'canvas', label: 'Excerpt → Canvas card' },
    { id: 'ai', label: 'AI research memo' },
    { id: 'share', label: 'Live share workspace', kind: 'terminal' },
    { id: 'search', label: 'Search everything' },
    { id: 'index', label: 'Bundle index' },
    { id: 'export', label: 'Export PNG / Markdown', kind: 'terminal' },
    { id: 'settings', label: 'Settings', kind: 'screen' },
  ],
  edges: [
    { from: 'splash', to: 'auth' },
    { from: 'auth', to: 'google', label: 'cloud' },
    { from: 'auth', to: 'perms', label: 'local' },
    { from: 'google', to: 'perms' },
    { from: 'perms', to: 'onboard' },
    { from: 'onboard', to: 'home' },
    { from: 'home', to: 'open' },
    { from: 'open', to: 'read' },
    { from: 'read', to: 'canvas' },
    { from: 'home', to: 'ai' },
    { from: 'ai', to: 'canvas' },
    { from: 'home', to: 'share' },
    { from: 'canvas', to: 'share', label: 'invite' },
    { from: 'home', to: 'search' },
    { from: 'home', to: 'index' },
    { from: 'home', to: 'export' },
    { from: 'home', to: 'settings' },
    { from: 'settings', to: 'home' },
  ],
};

const nav: { nodes: FlowNode[]; edges: FlowEdge[] } = {
  nodes: [
    { id: 'app', label: 'LitNotes Canvas', kind: 'key' },
    { id: 'auth', label: 'Auth', kind: 'screen' },
    { id: 'ws', label: 'Workspace', kind: 'key' },
    { id: 'set', label: 'Settings', kind: 'screen' },
    { id: 'reader', label: 'Reader pane' },
    { id: 'board', label: 'Canvas pane' },
    { id: 'sheets', label: 'Side sheets' },
    { id: 'sSearch', label: 'Search' },
    { id: 'sResearch', label: 'Research' },
    { id: 'sIndex', label: 'Index' },
    { id: 'sExport', label: 'Export' },
    { id: 'sAppear', label: 'Appearance' },
    { id: 'sAccount', label: 'Account' },
    { id: 'sAI', label: 'AI & API key' },
    { id: 'sPerms', label: 'Permissions' },
    { id: 'sData', label: 'Data & backup' },
    { id: 'sAbout', label: 'About' },
  ],
  edges: [
    { from: 'app', to: 'auth' },
    { from: 'app', to: 'ws' },
    { from: 'app', to: 'set' },
    { from: 'ws', to: 'reader' },
    { from: 'ws', to: 'board' },
    { from: 'ws', to: 'sheets' },
    { from: 'sheets', to: 'sSearch' },
    { from: 'sheets', to: 'sResearch' },
    { from: 'sheets', to: 'sIndex' },
    { from: 'sheets', to: 'sExport' },
    { from: 'set', to: 'sAppear' },
    { from: 'set', to: 'sAccount' },
    { from: 'set', to: 'sAI' },
    { from: 'set', to: 'sPerms' },
    { from: 'set', to: 'sData' },
    { from: 'set', to: 'sAbout' },
  ],
};

const funcMap: { nodes: FlowNode[]; edges: FlowEdge[] } = {
  nodes: [
    { id: 'root', label: 'App', kind: 'key' },
    { id: 'mRead', label: 'Reading', kind: 'process' },
    { id: 'mAnnot', label: 'Annotation', kind: 'process' },
    { id: 'mCanvas', label: 'Canvas', kind: 'process' },
    { id: 'mAI', label: 'AI Research', kind: 'process' },
    { id: 'mOrg', label: 'Organisation', kind: 'process' },
    { id: 'mData', label: 'Data & Account', kind: 'process' },
    { id: 'fOpen', label: 'Open PDF' },
    { id: 'fPage', label: 'Paginate' },
    { id: 'fOCR', label: 'OCR scan' },
    { id: 'fHl', label: 'Highlight' },
    { id: 'fCat', label: 'Categorise' },
    { id: 'fNote', label: 'Notes' },
    { id: 'fCard', label: 'Cards' },
    { id: 'fInk', label: 'Ink draw' },
    { id: 'fLink', label: 'Link / threads' },
    { id: 'fOff', label: 'Offline pack' },
    { id: 'fLive', label: 'Live LLM' },
    { id: 'fMemo', label: 'Memo → card' },
    { id: 'fBundle', label: 'Bundle index' },
    { id: 'fSearch', label: 'Search' },
    { id: 'fAuth', label: 'Auth / session' },
    { id: 'fPersist', label: 'Persist' },
    { id: 'fExport', label: 'Export' },
    { id: 'fPerms', label: 'Permissions' },
  ],
  edges: [
    { from: 'root', to: 'mRead' },
    { from: 'root', to: 'mAnnot' },
    { from: 'root', to: 'mCanvas' },
    { from: 'root', to: 'mAI' },
    { from: 'root', to: 'mOrg' },
    { from: 'root', to: 'mData' },
    { from: 'mRead', to: 'fOpen' },
    { from: 'mRead', to: 'fPage' },
    { from: 'mRead', to: 'fOCR' },
    { from: 'mAnnot', to: 'fHl' },
    { from: 'mAnnot', to: 'fCat' },
    { from: 'mAnnot', to: 'fNote' },
    { from: 'mCanvas', to: 'fCard' },
    { from: 'mCanvas', to: 'fInk' },
    { from: 'mCanvas', to: 'fLink' },
    { from: 'mAI', to: 'fOff' },
    { from: 'mAI', to: 'fLive' },
    { from: 'mAI', to: 'fMemo' },
    { from: 'mOrg', to: 'fBundle' },
    { from: 'mOrg', to: 'fSearch' },
    { from: 'mData', to: 'fAuth' },
    { from: 'mData', to: 'fPersist' },
    { from: 'mData', to: 'fExport' },
    { from: 'mData', to: 'fPerms' },
  ],
};

const dfd: { nodes: FlowNode[]; edges: FlowEdge[] } = {
  nodes: [
    { id: 'eUser', label: 'User', kind: 'external' },
    { id: 'ePdf', label: 'PDF file', kind: 'external' },
    { id: 'eAI', label: 'Anthropic API', kind: 'external' },
    { id: 'p1', label: 'Capture highlight', kind: 'process' },
    { id: 'p2', label: 'Canvas ops', kind: 'process' },
    { id: 'p3', label: 'OCR index', kind: 'process' },
    { id: 'p4', label: 'Research', kind: 'process' },
    { id: 'p5', label: 'Export', kind: 'process' },
    { id: 'store', label: 'Workspace store', kind: 'store' },
  ],
  edges: [
    { from: 'eUser', to: 'p1', label: 'draw rect' },
    { from: 'p1', to: 'store', label: 'highlight + node' },
    { from: 'ePdf', to: 'p3', label: 'page image' },
    { from: 'p3', to: 'store', label: 'page text' },
    { from: 'eUser', to: 'p2', label: 'drag / ink' },
    { from: 'p2', to: 'store', label: 'edges / ink' },
    { from: 'eUser', to: 'p4', label: 'query' },
    { from: 'p4', to: 'eAI', label: 'prompt' },
    { from: 'eAI', to: 'p4', label: 'memo' },
    { from: 'p4', to: 'store', label: 'AI node' },
    { from: 'store', to: 'p5', label: 'snapshot' },
    { from: 'p5', to: 'eUser', label: 'file' },
  ],
};

const sessionStates: { nodes: FlowNode[]; edges: FlowEdge[] } = {
  nodes: [
    { id: 's0', label: 'Launching', kind: 'terminal' },
    { id: 's1', label: 'Unauthenticated' },
    { id: 's2', label: 'Authenticating', kind: 'process' },
    { id: 's3', label: 'Permission prompt', kind: 'process' },
    { id: 's4', label: 'Onboarding' },
    { id: 's5', label: 'Active session', kind: 'key' },
    { id: 's6', label: 'Backgrounded / locked' },
  ],
  edges: [
    { from: 's0', to: 's1' },
    { from: 's1', to: 's2', label: 'submit' },
    { from: 's2', to: 's3', label: 'success' },
    { from: 's2', to: 's1', label: 'error' },
    { from: 's3', to: 's4', label: 'first run' },
    { from: 's3', to: 's5', label: 'returning' },
    { from: 's4', to: 's5' },
    { from: 's5', to: 's6', label: 'background' },
    { from: 's6', to: 's5', label: 'resume' },
    { from: 's5', to: 's1', label: 'log out' },
  ],
};

const authSeq: { actors: string[]; messages: SeqMsg[] } = {
  actors: ['User', 'SplashGate', 'AuthScreen', 'AuthService', 'Permissions', 'Store'],
  messages: [
    { from: 0, to: 1, label: 'launch app' },
    { from: 1, to: 5, label: 'check session' },
    { from: 5, to: 1, label: 'no session', dashed: true },
    { from: 1, to: 2, label: 'show sign in' },
    { from: 0, to: 2, label: 'submit credentials' },
    { from: 2, to: 3, label: 'authenticate()' },
    { from: 3, to: 5, label: 'persist session' },
    { from: 3, to: 2, label: 'ok', dashed: true },
    { from: 2, to: 4, label: 'request files / notif / camera' },
    { from: 4, to: 0, label: 'system prompts' },
    { from: 0, to: 4, label: 'grant / deny' },
    { from: 4, to: 5, label: 'save grants' },
    { from: 2, to: 0, label: 'enter workspace', dashed: true },
  ],
};

const highlightSeq: { actors: string[]; messages: SeqMsg[] } = {
  actors: ['User', 'PdfReader', 'Popover', 'Store', 'CanvasBoard', 'Storage'],
  messages: [
    { from: 0, to: 1, label: 'tap + draw rect' },
    { from: 1, to: 2, label: 'open with rect' },
    { from: 0, to: 2, label: 'pick category + note' },
    { from: 2, to: 3, label: 'addHighlight() + addExcerptNode()' },
    { from: 3, to: 5, label: 'saveWorkspaceDebounced' },
    { from: 3, to: 4, label: 're-render node', dashed: true },
    { from: 4, to: 0, label: 'card appears', dashed: true },
  ],
};

const liveShareSeq: { actors: string[]; messages: SeqMsg[] } = {
  actors: ['Owner', 'CollabStore', 'Realtime', 'Store', 'Peer'],
  messages: [
    { from: 0, to: 1, label: 'startShare(edit|view)' },
    { from: 1, to: 2, label: 'subscribe room:CODE + track presence' },
    { from: 1, to: 3, label: 'getSyncState()' },
    { from: 1, to: 2, label: 'broadcast snapshot' },
    { from: 4, to: 2, label: 'join via link / code' },
    { from: 2, to: 4, label: 'presence sync (avatars)', dashed: true },
    { from: 4, to: 2, label: 'request_snapshot' },
    { from: 2, to: 4, label: 'snapshot → applyRemote', dashed: true },
    { from: 0, to: 3, label: 'edit card / ink' },
    { from: 3, to: 2, label: 'debounced snapshot' },
    { from: 2, to: 4, label: 'live update + cursor', dashed: true },
  ],
};

type Entity = { name: string; fields: { name: string; tag?: 'PK' | 'FK' }[] };
const entities: Entity[] = [
  {
    name: 'User',
    fields: [{ name: 'id', tag: 'PK' }, { name: 'email' }, { name: 'displayName' }, { name: 'createdAt' }],
  },
  {
    name: 'Settings',
    fields: [
      { name: 'userId', tag: 'FK' },
      { name: 'themeMode' },
      { name: 'apiKeyRef' },
      { name: 'permissions' },
      { name: 'autoOcr' },
    ],
  },
  {
    name: 'Workspace',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'userId', tag: 'FK' },
      { name: 'docName' },
      { name: 'docUri' },
      { name: 'numPages' },
      { name: 'updatedAt' },
    ],
  },
  {
    name: 'Highlight',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'workspaceId', tag: 'FK' },
      { name: 'page' },
      { name: 'rect' },
      { name: 'category' },
      { name: 'text' },
      { name: 'note' },
    ],
  },
  {
    name: 'CanvasNode',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'workspaceId', tag: 'FK' },
      { name: 'type (excerpt|ai)' },
      { name: 'x, y' },
      { name: 'highlightId', tag: 'FK' },
      { name: 'payload' },
    ],
  },
  {
    name: 'Edge',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'fromNodeId', tag: 'FK' },
      { name: 'toNodeId', tag: 'FK' },
    ],
  },
  {
    name: 'InkStroke',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'workspaceId', tag: 'FK' },
      { name: 'points' },
      { name: 'color' },
    ],
  },
  {
    name: 'InkLink',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'strokeId', tag: 'FK' },
      { name: 'target (hl | page+xy)' },
    ],
  },
  {
    name: 'OcrPage',
    fields: [
      { name: 'workspaceId', tag: 'FK' },
      { name: 'page', tag: 'PK' },
      { name: 'text' },
    ],
  },
  {
    name: 'Bookmark',
    fields: [
      { name: 'id', tag: 'PK' },
      { name: 'workspaceId', tag: 'FK' },
      { name: 'section' },
      { name: 'title' },
      { name: 'page' },
      { name: 'order' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function ThemeReference() {
  const rows: [string, string, string][] = [
    ['bg', '#0A0C12', 'App base — blue-black'],
    ['surface', '#141822', 'Cards, toolbars'],
    ['surfaceGlass', 'rgba(20,25,36,0.55)', 'Frosted panels'],
    ['accent', '#E8A13C', 'Primary — warm brass'],
    ['ai', '#38E0C8', 'AI / research channel'],
    ['iris', '#7C8CF8', 'Threads / links'],
    ['text', '#F0F2F7', 'Primary text'],
  ];
  return (
    <Table
      headers={['Token', 'Dark value', 'Role']}
      rows={rows.map((r) => [<Code>{r[0]}</Code>, <Code>{r[1]}</Code>, r[2]])}
      columnAlign={['left', 'left', 'left']}
    />
  );
}

function UseCaseDiagram() {
  const theme = useHostTheme();
  const useCases = [
    'Sign in / Sign up',
    'Grant permissions',
    'Open judgment PDF',
    'Highlight passage',
    'Categorise excerpt',
    'Work on canvas',
    'Draw & link ink',
    'Run AI research',
    'Search everything',
    'Build bundle index',
    'Export notes / PNG',
    'Manage settings',
  ];
  const ActorCol = ({ name, role }: { name: string; role: string }) => (
    <Stack gap={6}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          border: `1.8px solid ${theme.accent.primary}`,
          alignSelf: 'center',
        }}
      />
      <Text weight="semibold" style={{ textAlign: 'center' }}>
        {name}
      </Text>
      <Text size="small" tone="tertiary" style={{ textAlign: 'center' }}>
        {role}
      </Text>
    </Stack>
  );
  return (
    <Grid columns="120px 1fr 120px" gap={16} align="center">
      <ActorCol name="Legal Researcher" role="primary actor" />
      <Card>
        <CardHeader>System boundary · LitNotes Canvas</CardHeader>
        <CardBody>
          <Row gap={8} wrap>
            {useCases.map((u) => (
              <div key={u}>
                <Pill>{u}</Pill>
              </div>
            ))}
          </Row>
        </CardBody>
      </Card>
      <ActorCol name="Anthropic API" role="secondary actor" />
    </Grid>
  );
}

function ArchitectureDiagram() {
  const theme = useHostTheme();
  const layers: { name: string; items: string[]; accent?: boolean }[] = [
    {
      name: 'Presentation (React Native components)',
      items: ['TopBar', 'PdfReader', 'CanvasBoard', 'ThreadLayer', 'Panels', 'Auth', 'Settings'],
    },
    {
      name: 'State (Zustand stores)',
      items: ['workspace', 'ui', 'research', 'ocr', 'authStore', 'collabStore'],
      accent: true,
    },
    {
      name: 'Domain services',
      items: ['researchCore', 'ocrService', 'exportService', 'searchIndex', 'supabase', 'permissionsService'],
    },
    { name: 'Persistence', items: ['AsyncStorage (per-user workspace / settings)', 'FileSystem (PDF copy)'] },
    {
      name: 'Native modules & libraries',
      items: ['react-native-pdf', 'Skia', 'ML Kit OCR', 'Blur', 'DocumentPicker', 'Share', 'ViewShot', 'Google Sign-In'],
    },
    {
      name: 'Cloud & realtime (optional)',
      items: ['Supabase Auth (email + Google)', 'Supabase Realtime (presence / broadcast)', 'Anthropic API — live research'],
    },
  ];
  return (
    <Stack gap={8}>
      {layers.map((l) => (
        <div
          key={l.name}
          style={{
            border: `1px solid ${l.accent ? theme.accent.primary : theme.stroke.primary}`,
            borderRadius: 12,
            padding: 12,
            background: theme.bg.elevated,
          }}>
          <Text size="small" tone="secondary" weight="semibold" style={{ marginBottom: 8 }}>
            {l.name}
          </Text>
          <Row gap={8} wrap>
            {l.items.map((it) => (
              <div
                key={it}
                style={{
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: `1px solid ${theme.stroke.secondary}`,
                  background: theme.fill.secondary,
                }}>
                <Text size="small">{it}</Text>
              </div>
            ))}
          </Row>
        </div>
      ))}
      <Text size="small" tone="tertiary">
        Data flows top → bottom; only the stores talk to persistence. The network is optional and
        opt-in: research (Anthropic), cloud auth and live sharing (Supabase). With no keys, the app
        runs fully on-device.
      </Text>
    </Stack>
  );
}

function ERModel() {
  const theme = useHostTheme();
  return (
    <Stack gap={16}>
      <Grid columns={3} gap={12}>
        {entities.map((e) => (
          <div key={e.name}>
            <Card>
              <CardHeader>{e.name}</CardHeader>
              <CardBody style={{ padding: 10 }}>
                <Stack gap={4}>
                  {e.fields.map((f) => (
                    <div key={f.name}>
                      <Row gap={6} align="center" justify="space-between">
                        <Text size="small">
                          <Code>{f.name}</Code>
                        </Text>
                        {f.tag ? (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              letterSpacing: 0.4,
                              color: f.tag === 'PK' ? theme.accent.primary : theme.text.tertiary,
                            }}>
                            {f.tag}
                          </span>
                        ) : null}
                      </Row>
                    </div>
                  ))}
                </Stack>
              </CardBody>
            </Card>
          </div>
        ))}
      </Grid>
      <H3>Relationships</H3>
      <Table
        headers={['From', 'Cardinality', 'To']}
        rows={[
          ['User', '1 — 1', 'Settings'],
          ['User', '1 — *', 'Workspace'],
          ['Workspace', '1 — *', 'Highlight'],
          ['Workspace', '1 — *', 'CanvasNode'],
          ['Highlight', '1 — 0..1', 'CanvasNode'],
          ['CanvasNode', '1 — *', 'Edge (from / to)'],
          ['Workspace', '1 — *', 'InkStroke'],
          ['InkStroke', '1 — *', 'InkLink'],
          ['Workspace', '1 — *', 'OcrPage'],
          ['Workspace', '1 — *', 'Bookmark'],
        ]}
        columnAlign={['left', 'center', 'left']}
      />
    </Stack>
  );
}

function SDLC() {
  const phases: { name: string; status: string; tasks: string[] }[] = [
    {
      name: '1 · Requirements',
      status: 'Done',
      tasks: ['Legal research workflow', 'Tablet-first scope', 'Added: cloud + live sharing'],
    },
    {
      name: '2 · UX / UI Design',
      status: 'Done',
      tasks: ['User + navigation flows', 'Obsidian Chamber theme', 'Auth / settings / share UI'],
    },
    {
      name: '3 · Architecture',
      status: 'Done',
      tasks: ['Shared primitives + stores', 'Per-user storage + session gate', 'Pluggable realtime layer'],
    },
    {
      name: '4 · Implementation',
      status: 'Now',
      tasks: ['Core app complete', 'Cloud auth + live share coded', 'Needs keys + native rebuild'],
    },
    {
      name: '5 · Testing / QA',
      status: 'Next',
      tasks: ['On-device smoke test', 'Multiplayer dry-run', 'Light / dark / permission cases'],
    },
    {
      name: '6 · Release & Maintenance',
      status: 'Next',
      tasks: ['App icons + store assets', 'Crash / analytics opt-in', 'Iterate on demo feedback'],
    },
  ];
  return (
    <Grid columns={3} gap={12}>
      {phases.map((ph) => (
        <div key={ph.name}>
          <Card>
            <CardHeader trailing={<Pill size="sm" active={ph.status === 'Now'}>{ph.status}</Pill>}>
              {ph.name}
            </CardHeader>
            <CardBody style={{ padding: 12 }}>
              <Stack gap={4}>
                {ph.tasks.map((t) => (
                  <div key={t}>
                    <Text size="small" tone="secondary">
                      • {t}
                    </Text>
                  </div>
                ))}
              </Stack>
            </CardBody>
          </Card>
        </div>
      ))}
    </Grid>
  );
}

/* ------------------------------------------------------------------ */
/* Build status                                                        */
/* ------------------------------------------------------------------ */

function StatusSummary() {
  return (
    <Grid columns={4} gap={12}>
      <Stat value="14" label="Shipping (offline)" tone="success" />
      <Stat value="5" label="Coded · needs keys/device" tone="warning" />
      <Stat value="6" label="Pending / not built" tone="info" />
      <Stat value="0" label="TypeScript errors" tone="success" />
    </Grid>
  );
}

const builtRows: [string, string, string][] = [
  ['PDF reader — open, paginate, per-page OCR + scan-all', 'Reader', 'Solid'],
  ['Highlight → categorise → excerpt card', 'Annotation', 'Solid'],
  ['Infinite canvas — pan/zoom, drag, edges, ink, links', 'Canvas', 'Solid'],
  ['Neon thread overlay (Skia glow)', 'Canvas', 'Solid'],
  ['AI research — offline pack + live memo → card', 'AI', 'Good'],
  ['Search across highlights / notes / OCR text', 'Organise', 'Good'],
  ['Bundle index / bookmarks with reorder', 'Organise', 'Good'],
  ['Export — canvas PNG + notes Markdown', 'Output', 'Good'],
  ['Obsidian Chamber theme — light/dark/system, reactive', 'Design', 'Solid'],
  ['App flow — splash → auth → perms → onboarding → workspace', 'Shell', 'Solid'],
  ['Local offline accounts + persisted session', 'Auth', 'Good'],
  ['Settings — 8 sections incl. Reading & Collaboration', 'Settings', 'Solid'],
  ['Per-user workspace isolation (no cross-account leak)', 'Data', 'Solid'],
  ['Auto-OCR toggle + persisted permission state', 'Settings', 'Solid'],
];

const partialRows: [string, string, string][] = [
  ['Cloud auth — Supabase email + Google sign-in', 'Coded, untested', 'Needs Supabase keys + one native rebuild'],
  ['Live sharing — presence, cursors, snapshot sync, roles', 'Coded, untested', 'Needs Supabase keys; on-device dry-run'],
  ['iOS permission prompts', 'Partial', 'Android real; iOS auto-granted (no native module)'],
  ['Apple sign-in', 'Stub', 'Placeholder button only'],
  ['Session lock on background', 'Design only', 'State modelled, not yet wired'],
];

const pendingRows: [string, string][] = [
  ['PDF binary sync to peers (Supabase Storage)', 'Peers sync notes layer, not the file yet'],
  ['CRDT per-field merge for simultaneous editing', 'Currently last-writer-wins snapshots'],
  ['Automated tests / full QA sweep', 'No test suite yet'],
  ['App icons, splash assets, store listing', 'Default RN assets'],
  ['Crash / analytics opt-in', 'Not instrumented'],
  ['Research offline queue + retries', 'Single-shot calls today'],
];

function toneForQuality(q: string): 'success' | 'warning' {
  return q === 'Solid' || q === 'Good' ? 'success' : 'warning';
}

function BuiltTable() {
  return (
    <Table
      headers={['Capability', 'Area', 'Quality']}
      rows={builtRows.map((r) => [r[0], r[1], <Text weight="semibold">{r[2]}</Text>])}
      columnAlign={['left', 'left', 'left']}
      rowTone={builtRows.map((r) => toneForQuality(r[2]))}
      striped
    />
  );
}

function PartialTable() {
  return (
    <Table
      headers={['Capability', 'State', 'What it needs']}
      rows={partialRows.map((r) => [r[0], <Text weight="semibold">{r[1]}</Text>, r[2]])}
      columnAlign={['left', 'left', 'left']}
      rowTone={partialRows.map(() => 'warning')}
    />
  );
}

function PendingTable() {
  return (
    <Table
      headers={['Not built yet', 'Notes']}
      rows={pendingRows.map((r) => [r[0], r[1]])}
      columnAlign={['left', 'left']}
      rowTone={pendingRows.map(() => 'info')}
    />
  );
}

function QualityAssessment() {
  const rows: [string, string, string][] = [
    ['Core research loop (read → highlight → canvas → thread)', 'Strong', 'The product\u2019s spine. Fluid, tablet-first, Skia-smooth; the part most worth demoing.'],
    ['Visual design & theming', 'Strong', 'Cohesive Obsidian Chamber palette, unified Lucide icons, reactive light/dark/system.'],
    ['On-device data & accounts', 'Solid', 'Per-user isolation, debounced persistence, session restore. Local hashing is demo-grade, not production crypto.'],
    ['AI research', 'Good', 'Works offline; live mode is genuinely useful with an Anthropic key. No queue/retry yet.'],
    ['Cloud auth (Supabase + Google)', 'Promising', 'Cleanly abstracted with offline fallback; compiles and lints, but unverified on a device.'],
    ['Live collaboration', 'Promising', 'Presence, cursors, roles and real-time canvas sync are implemented end-to-end. Snapshot LWW (not CRDT); PDF file not yet shared; needs a multiplayer dry-run.'],
    ['Testing & release hardening', 'Early', 'No automated tests, default app assets, no analytics. Expected for a pre-demo build.'],
  ];
  const tone = (r: string): 'success' | 'warning' | 'info' =>
    r === 'Strong' || r === 'Solid' ? 'success' : r === 'Early' ? 'info' : 'warning';
  return (
    <Table
      headers={['Area', 'Rating', 'Assessment']}
      rows={rows.map((r) => [r[0], <Text weight="semibold">{r[1]}</Text>, r[2]])}
      columnAlign={['left', 'left', 'left']}
      rowTone={rows.map((r) => tone(r[1]))}
    />
  );
}

function LiveCollabOverview() {
  const theme = useHostTheme();
  const points: [string, string][] = [
    ['Transport', 'One Supabase Realtime channel per room (room:<CODE>). WebSocket, free tier.'],
    ['Presence', 'Who is in the room + name, colour and role — drives avatar pips and the participant list.'],
    ['State sync', 'Canvas, threads, ink, highlights, index and OCR broadcast as debounced snapshots (last-writer-wins); late joiners request the current state.'],
    ['Cursors', 'Broadcast in board/world coordinates, rendered per-peer and inverse-scaled to stay crisp at any zoom.'],
    ['Roles', 'Owner / editor / viewer. Viewers are read-only (canvas editing + PDF highlighting disabled).'],
    ['Invites', 'litnotes://join/<CODE>?a=edit|view deep link + 6-char room code; native share sheet.'],
  ];
  return (
    <Stack gap={8}>
      {points.map(([k, v]) => (
        <div
          key={k}
          style={{
            border: `1px solid ${theme.stroke.primary}`,
            borderRadius: 10,
            padding: '10px 12px',
            background: theme.bg.elevated,
          }}>
          <Row gap={10} align="start">
            <div style={{ minWidth: 82 }}>
              <Text size="small" weight="semibold">{k}</Text>
            </div>
            <Text size="small" tone="secondary">{v}</Text>
          </Row>
        </div>
      ))}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export default function LitNotesDesign() {
  const theme = useHostTheme();
  const legend = (
    <Row gap={16} wrap style={{ marginTop: 4 }}>
      <LegendDot label="Start / end" color={theme.accent.primary} />
      <LegendDot label="Screen / state" color={theme.stroke.primary} />
      <LegendDot label="Process" color={theme.stroke.primary} />
      <LegendDot label="Data store" color={theme.stroke.secondary} dashed />
    </Row>
  );

  return (
    <Stack gap={28} style={{ padding: 24, maxWidth: 1160 }}>
      <Stack gap={6}>
        <H1>LitNotes Canvas — UX & System Design</H1>
        <Text tone="tertiary">
          Tablet-first legal research app · "Obsidian Chamber" theme · now with Supabase cloud
          accounts + Figma-style live sharing. Status, build audit, flows, architecture and SDLC.
        </Text>
        <Text size="small" tone="tertiary">
          Updated Jul 14, 2026 · demo target Aug 9
        </Text>
      </Stack>

      <Callout tone="success" title="Where it stands">
        <Text size="small">
          The full research app is built and runs 100% offline today. Cloud sign-in (Supabase +
          Google) and live workspace sharing are implemented end-to-end, type-check clean, and
          switch on the moment you add Supabase keys — no code changes. They have not yet been run
          on a device, so a short dry-run is the main thing between here and the demo.
        </Text>
      </Callout>

      <Stack gap={10}>
        <H2>Status at a glance</H2>
        <StatusSummary />
      </Stack>

      <Stack gap={10}>
        <H2>What&rsquo;s built &amp; how good it is</H2>
        <Text tone="secondary" size="small">
          Shipping capabilities that work on-device today. Quality is a candid read, not a checkbox.
        </Text>
        <BuiltTable />
      </Stack>

      <Stack gap={10}>
        <H2>Built but not yet verified</H2>
        <Text tone="secondary" size="small">
          Code complete and compiling; each needs credentials and/or an on-device pass before it is
          demo-safe.
        </Text>
        <PartialTable />
      </Stack>

      <Stack gap={10}>
        <H2>Pending / not built</H2>
        <PendingTable />
      </Stack>

      <Stack gap={10}>
        <H2>Quality assessment</H2>
        <QualityAssessment />
      </Stack>

      <Callout tone="warning" title="Before the demo">
        <Stack gap={4}>
          <Text size="small">
            1 · Create a Supabase project, paste URL + anon key in Settings → Collaboration (no
            rebuild needed for that step).
          </Text>
          <Text size="small">
            2 · (Optional) Configure Google OAuth and add the client IDs, then rebuild once for the
            new native Google Sign-In module.
          </Text>
          <Text size="small">
            3 · Run a two-device dry-run of live sharing (presence, cursors, edit/view roles) and a
            light/dark + permissions pass.
          </Text>
        </Stack>
      </Callout>

      <Divider />

      <Callout tone="info" title="Confirmed decisions">
        <Stack gap={4}>
          <Text size="small">
            Theme follows the device default, defaults to Light when unset, with a manual System /
            Light / Dark override in Settings.
          </Text>
          <Text size="small">
            Settings covers Appearance, Reading, Account, AI & API key, Collaboration, Permissions,
            Data & backup, About.
          </Text>
          <Text size="small">
            Permissions (files, notifications, media for OCR) are requested during login and their
            grant-state is persisted.
          </Text>
          <Text size="small">
            Sharing backend is Supabase Realtime; identity is Supabase Auth with Google + email, and
            guests can join a live room from an invite link.
          </Text>
        </Stack>
      </Callout>

      <Stack gap={10}>
        <H2>Theme tokens — Obsidian Chamber</H2>
        <ThemeReference />
      </Stack>

      <Divider />

      <Stack gap={10}>
        <H2>1 · User flow</H2>
        <Text tone="secondary" size="small">
          Splash → auth → permissions → onboarding → workspace hub, then the core research loops.
          Settings returns to the workspace (dashed = return path).
        </Text>
        {legend}
        <FlowGraph id="userflow" nodes={userFlow.nodes} edges={userFlow.edges} direction="vertical" />
      </Stack>

      <Stack gap={10}>
        <H2>2 · Navigation / information architecture</H2>
        <Text tone="secondary" size="small">
          Screen hierarchy and where each panel and setting lives.
        </Text>
        <FlowGraph
          id="nav"
          nodes={nav.nodes}
          edges={nav.edges}
          direction="horizontal"
          nodeWidth={150}
          nodeHeight={46}
          nodeGap={18}
          rankGap={130}
        />
      </Stack>

      <Stack gap={10}>
        <H2>3 · Functional decomposition</H2>
        <Text tone="secondary" size="small">
          Feature modules broken into concrete capabilities.
        </Text>
        <FlowGraph
          id="func"
          nodes={funcMap.nodes}
          edges={funcMap.edges}
          direction="horizontal"
          nodeWidth={150}
          nodeHeight={46}
          nodeGap={16}
          rankGap={130}
        />
      </Stack>

      <Stack gap={10}>
        <H2>4 · Use case diagram</H2>
        <UseCaseDiagram />
      </Stack>

      <Stack gap={10}>
        <H2>5 · System architecture (layered)</H2>
        <ArchitectureDiagram />
      </Stack>

      <Stack gap={10}>
        <H2>6 · Data flow diagram (level 1)</H2>
        <Text tone="secondary" size="small">
          External entities (solid), processes (filled), and the single workspace data store
          (dashed).
        </Text>
        <FlowGraph
          id="dfd"
          nodes={dfd.nodes}
          edges={dfd.edges}
          direction="horizontal"
          nodeWidth={150}
          nodeHeight={50}
          nodeGap={30}
          rankGap={150}
        />
      </Stack>

      <Stack gap={10}>
        <H2>7 · Sequence — login & permissions</H2>
        <SequenceDiagram id="auth" actors={authSeq.actors} messages={authSeq.messages} />
      </Stack>

      <Stack gap={10}>
        <H2>8 · Sequence — highlight to canvas</H2>
        <SequenceDiagram id="hl" actors={highlightSeq.actors} messages={highlightSeq.messages} />
      </Stack>

      <Stack gap={10}>
        <H2>9 · Live collaboration — how sharing works</H2>
        <Text tone="secondary" size="small">
          A pluggable realtime layer on Supabase. The Share UI, presence, cursors and roles are
          identical regardless of backend; only the transport underneath is swappable.
        </Text>
        <LiveCollabOverview />
      </Stack>

      <Stack gap={10}>
        <H2>10 · Sequence — live share session</H2>
        <Text tone="secondary" size="small">
          Owner starts a room; a peer joins by link and catches up via a snapshot; edits stream live
          (dashed = pushed to peers).
        </Text>
        <SequenceDiagram id="live" actors={liveShareSeq.actors} messages={liveShareSeq.messages} />
      </Stack>

      <Stack gap={10}>
        <H2>11 · Session state machine</H2>
        <Text tone="secondary" size="small">
          Dashed transitions are error / return / logout edges. "Backgrounded / locked" is modelled
          but not yet wired in code.
        </Text>
        <FlowGraph
          id="state"
          nodes={sessionStates.nodes}
          edges={sessionStates.edges}
          direction="vertical"
          nodeWidth={180}
          nodeHeight={50}
        />
      </Stack>

      <Stack gap={10}>
        <H2>12 · Data model (ER)</H2>
        <Text tone="secondary" size="small">
          Workspaces are now scoped per user; Settings persists theme, permissions and autoOcr. Live
          rooms are ephemeral (presence + broadcast), not persisted tables.
        </Text>
        <ERModel />
      </Stack>

      <Stack gap={10}>
        <H2>13 · SDLC — where we are</H2>
        <SDLC />
      </Stack>
    </Stack>
  );
}
