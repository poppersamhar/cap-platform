import { useRef, useEffect } from 'react';
import { projects, agents, skills } from '../data/mockData';
import type { ExcludeRect } from './DraggableChat';

/* ─── Types ─── */
interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  floatPhase: number;
  floatSpeed: number;
  layer: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

function buildGraph(projectId: string) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const degree = new Map<string, number>();
  const inc = (id: string) => degree.set(id, (degree.get(id) || 0) + 1);

  const makeNode = (id: string, label: string, radius: number, mass: number, layer: number): GraphNode => ({
    id, label, x: 0, y: 0, baseX: 0, baseY: 0, vx: 0, vy: 0, radius, mass,
    floatPhase: Math.random() * Math.PI * 2,
    floatSpeed: 0.0004 + Math.random() * 0.0008,
    layer,
  });

  nodes.push(makeNode(project.id, project.name, 14, 5, 0));

  const relatedAgents = agents.filter((a) => a.workLine === project.name);
  relatedAgents.forEach((agent) => {
    nodes.push(makeNode(agent.id, agent.name, 8.5, 2, 1));
    edges.push({ source: project.id, target: agent.id });
    inc(project.id); inc(agent.id);
  });

  const relatedSkills = skills.filter((s) =>
    relatedAgents.some((a) => a.mountedSkills.includes(s.id))
  );
  relatedSkills.forEach((skill) => {
    nodes.push(makeNode(skill.id, skill.name, 6.5, 1.3, 1));
    const parent = relatedAgents.find((a) => a.mountedSkills.includes(skill.id));
    if (parent) {
      edges.push({ source: parent.id, target: skill.id });
      inc(parent.id); inc(skill.id);
    }
  });

  const files = ['sales_q3.xlsx', 'region_data.csv', 'budget_notes.md'];
  files.forEach((name, i) => {
    const fid = `file-${i}`;
    nodes.push(makeNode(fid, name, 5.5, 1, 2));
    edges.push({ source: project.id, target: fid });
    inc(project.id); inc(fid);
  });

  const keypoints = ['营收对比分析', '消费者业务下滑', '海外市场+34%'];
  keypoints.forEach((kp, i) => {
    const kid = `kp-${i}`;
    nodes.push(makeNode(kid, kp, 5.5, 1, 2));
    edges.push({ source: project.id, target: kid });
    inc(project.id); inc(kid);
  });

  nodes.forEach((n) => {
    const d = degree.get(n.id) || 0;
    if (d >= 6) n.radius = 16;
    else if (d >= 4) n.radius = 11;
    else if (d >= 2) n.radius = 8;
  });

  return { nodes, edges };
}

export default function KnowledgeGraph({
  projectId,
  excludeRectRef,
}: {
  projectId: string;
  excludeRectRef?: React.RefObject<ExcludeRect | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const graphRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const prevExRef = useRef<{ cx: number; cy: number; active: boolean }>({ cx: 0, cy: 0, active: false });

  useEffect(() => {
    const { nodes, edges } = buildGraph(projectId);
    graphRef.current = { nodes, edges };
    prevExRef.current = { cx: 0, cy: 0, active: false };
  }, [projectId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const { nodes, edges } = graphRef.current;
    const cx = W / 2;
    const cy = H / 2;
    const minDim = Math.min(W, H);

    const centerNodes = nodes.filter((n) => n.layer === 0);
    const midNodes = nodes.filter((n) => n.layer === 1);
    const outerNodes = nodes.filter((n) => n.layer === 2);

    centerNodes.forEach((n) => {
      n.x = cx + (Math.random() - 0.5) * 40;
      n.y = cy + (Math.random() - 0.5) * 40;
    });

    midNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, midNodes.length)) * Math.PI * 2 + Math.random() * 0.5;
      const r = minDim * (0.38 + Math.random() * 0.18);
      n.x = cx + Math.cos(angle) * r;
      n.y = cy + Math.sin(angle) * r;
    });

    outerNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, outerNodes.length)) * Math.PI * 2 + Math.random() * 0.8;
      const r = minDim * (0.62 + Math.random() * 0.22);
      n.x = cx + Math.cos(angle) * r;
      n.y = cy + Math.sin(angle) * r;
    });

    // 预热收敛
    for (let f = 0; f < 1500; f++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (1200 * a.mass * b.mass) / (dist * dist);
          a.vx -= (dx / dist) * force / a.mass;
          a.vy -= (dy / dist) * force / a.mass;
          b.vx += (dx / dist) * force / b.mass;
          b.vy += (dy / dist) * force / b.mass;
        }
      }
      edges.forEach((e) => {
        const a = nodes.find((n) => n.id === e.source);
        const b = nodes.find((n) => n.id === e.target);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 260) * 0.004;
        a.vx += (dx / dist) * force / a.mass;
        a.vy += (dy / dist) * force / a.mass;
        b.vx -= (dx / dist) * force / b.mass;
        b.vy -= (dy / dist) * force / b.mass;
      });
      const pad = 40;
      nodes.forEach((n) => {
        if (n.x < pad) n.vx += (pad - n.x) * 0.04;
        if (n.x > W - pad) n.vx -= (n.x - (W - pad)) * 0.04;
        if (n.y < pad) n.vy += (pad - n.y) * 0.04;
        if (n.y > H - pad) n.vy -= (n.y - (H - pad)) * 0.04;
      });
      nodes.forEach((n) => {
        n.vx *= 0.94; n.vy *= 0.94;
        n.x += n.vx; n.y += n.vy;
      });
    }

    nodes.forEach((n) => { n.baseX = n.x; n.baseY = n.y; n.vx = 0; n.vy = 0; });

    // ─── 流体渲染循环 ───
    const NODE_REPULSE = 300;
    const FLOW_SPRING = 0.002;
    const FLOW_REST = 280;
    const BOUNDARY_K = 0.02;
    const MOTION_DAMP = 0.97;
    const JITTER = 0.025;
    const RETURN_K = 0.004;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const ex = excludeRectRef?.current;
      const exActive = ex && ex.active;
      const now = Date.now();

      // 排斥当前 BizAgent 位置
      if (exActive) {
        const exCX = ex.x + ex.width / 2;
        const exCY = ex.y + ex.height / 2;

        nodes.forEach((n) => {
          const dx = n.x - exCX;
          const dy = n.y - exCY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 150) {
            const t = 1 - dist / 150;
            const strength = t * t * 0.06;
            n.vx += (dx / dist) * strength;
            n.vy += (dy / dist) * strength;
          }
        });

        // 吸引上一位置（后方流入）
        if (prevExRef.current.active) {
          const moved = Math.abs(exCX - prevExRef.current.cx) + Math.abs(exCY - prevExRef.current.cy);
          if (moved > 2) {
            nodes.forEach((n) => {
              const dx = prevExRef.current.cx - n.x;
              const dy = prevExRef.current.cy - n.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dist < 220) {
                const t = 1 - dist / 220;
                const strength = t * t * 0.035;
                n.vx += (dx / dist) * strength;
                n.vy += (dy / dist) * strength;
              }
            });
          }
        }

        prevExRef.current = { cx: exCX, cy: exCY, active: true };
      } else {
        prevExRef.current.active = false;
      }

      nodes.forEach((n) => {
        if (n === draggedNodeRef.current) {
          n.vx = 0; n.vy = 0;
          n.baseX = n.x; n.baseY = n.y;
          return;
        }

        // 微扰动
        n.vx += (Math.random() - 0.5) * JITTER;
        n.vy += (Math.random() - 0.5) * JITTER;

        // 极弱回归
        n.vx += (n.baseX - n.x) * RETURN_K;
        n.vy += (n.baseY - n.y) * RETURN_K;
      });

      // 持续节点间斥力
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (NODE_REPULSE * a.mass * b.mass) / (dist * dist);
          a.vx -= (dx / dist) * force / a.mass;
          a.vy -= (dy / dist) * force / a.mass;
          b.vx += (dx / dist) * force / b.mass;
          b.vy += (dy / dist) * force / b.mass;
        }
      }

      // 持续弱弹簧
      edges.forEach((e) => {
        const a = nodes.find((n) => n.id === e.source);
        const b = nodes.find((n) => n.id === e.target);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - FLOW_REST) * FLOW_SPRING;
        a.vx += (dx / dist) * force / a.mass;
        a.vy += (dy / dist) * force / a.mass;
        b.vx -= (dx / dist) * force / b.mass;
        b.vy -= (dy / dist) * force / b.mass;
      });

      // 软边界
      const pad = 45;
      nodes.forEach((n) => {
        if (n.x < pad) n.vx += (pad - n.x) * BOUNDARY_K;
        if (n.x > W - pad) n.vx -= (n.x - (W - pad)) * BOUNDARY_K;
        if (n.y < pad) n.vy += (pad - n.y) * BOUNDARY_K;
        if (n.y > H - pad) n.vy -= (n.y - (H - pad)) * BOUNDARY_K;
      });

      // 积分
      nodes.forEach((n) => {
        n.vx *= MOTION_DAMP;
        n.vy *= MOTION_DAMP;
        n.x += n.vx;
        n.y += n.vy;
      });

      /* ─── Render ─── */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 0.7;
      edges.forEach((e) => {
        const a = nodes.find((n) => n.id === e.source);
        const b = nodes.find((n) => n.id === e.target);
        if (!a || !b) return;
        const ax = a.x + Math.sin(now * a.floatSpeed + a.floatPhase) * 0.6;
        const ay = a.y + Math.cos(now * a.floatSpeed * 0.7 + a.floatPhase) * 0.5;
        const bx = b.x + Math.sin(now * b.floatSpeed + b.floatPhase) * 0.6;
        const by = b.y + Math.cos(now * b.floatSpeed * 0.7 + b.floatPhase) * 0.5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      });

      nodes.forEach((n) => {
        const floatX = Math.sin(now * n.floatSpeed + n.floatPhase) * 0.6;
        const floatY = Math.cos(now * n.floatSpeed * 0.7 + n.floatPhase) * 0.5;
        const rx = n.x + floatX;
        const ry = n.y + floatY;

        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1.5;

        ctx.beginPath();
        ctx.arc(rx, ry, n.radius, 0, Math.PI * 2);
        if (hoveredNodeRef.current?.id === n.id) ctx.fillStyle = '#3b82f6';
        else if (draggedNodeRef.current?.id === n.id) ctx.fillStyle = '#2563eb';
        else ctx.fillStyle = '#52525b';
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.fillStyle = hoveredNodeRef.current?.id === n.id ? '#3b82f6' : '#3f3f46';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(n.label, rx + n.radius + 8, ry + 4);
      });

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [projectId, excludeRectRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const posOf = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const hitTest = (x: number, y: number) => {
      const now = Date.now();
      for (const n of graphRef.current.nodes) {
        const fx = Math.sin(now * n.floatSpeed + n.floatPhase) * 0.6;
        const fy = Math.cos(now * n.floatSpeed * 0.7 + n.floatPhase) * 0.5;
        const rx = n.x + fx;
        const ry = n.y + fy;
        const dx = x - rx;
        const dy = y - ry;
        if (dx * dx + dy * dy < (n.radius + 8) ** 2) return n;
      }
      return null;
    };

    const onDown = (e: MouseEvent) => {
      const hit = hitTest(posOf(e).x, posOf(e).y);
      if (hit) draggedNodeRef.current = hit;
    };
    const onMove = (e: MouseEvent) => {
      const p = posOf(e);
      if (draggedNodeRef.current) {
        draggedNodeRef.current.x = p.x;
        draggedNodeRef.current.y = p.y;
      }
      hoveredNodeRef.current = hitTest(p.x, p.y);
      canvas.style.cursor = draggedNodeRef.current ? 'grabbing' : hoveredNodeRef.current ? 'pointer' : 'default';
    };
    const onUp = () => { draggedNodeRef.current = null; };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-white">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
