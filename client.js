(function() {
	//#region focus-core.js
	var PERIOD_MS = Object.freeze({
		"3h": 108e5,
		"6h": 216e5,
		"1d": 864e5,
		"3d": 2592e5,
		all: Number.POSITIVE_INFINITY
	});
	var DEFAULT_PREFERENCES = Object.freeze({
		enabled: false,
		period: "1d",
		showProjects: false,
		showProjectLabels: false
	});
	function normalizePreferences(value) {
		if (value === null || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_PREFERENCES };
		return {
			enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_PREFERENCES.enabled,
			period: Object.hasOwn(PERIOD_MS, value.period) ? value.period : DEFAULT_PREFERENCES.period,
			showProjects: typeof value.showProjects === "boolean" ? value.showProjects : DEFAULT_PREFERENCES.showProjects,
			showProjectLabels: typeof value.showProjectLabels === "boolean" ? value.showProjectLabels : DEFAULT_PREFERENCES.showProjectLabels
		};
	}
	function visibleSessions(list, archivedSessionIds, period, now) {
		const archived = archivedSessionIds instanceof Set ? archivedSessionIds : new Set(archivedSessionIds || []);
		const maxAge = PERIOD_MS[period] ?? PERIOD_MS[DEFAULT_PREFERENCES.period];
		return (list?.ids || []).map((id) => list.byId[id]).filter(Boolean).filter((session) => session.origin !== "subagent" && !session.blank && !archived.has(session.id)).filter((session) => maxAge === Number.POSITIVE_INFINITY || now - session.updatedAt <= maxAge).sort((left, right) => right.updatedAt - left.updatedAt || String(left.id).localeCompare(String(right.id)));
	}
	function workspaceBySession(workspaces) {
		const result = /* @__PURE__ */ new Map();
		for (const workspace of workspaces || []) for (const sessionId of workspace.sessionIds || []) if (!result.has(sessionId)) result.set(sessionId, workspace);
		return result;
	}
	function groupSessions(sessions, workspaces, ungroupedLabel) {
		const owner = workspaceBySession(workspaces);
		const buckets = /* @__PURE__ */ new Map();
		for (const workspace of workspaces || []) buckets.set(workspace.workspaceId, {
			key: workspace.workspaceId,
			title: workspace.title || workspace.path,
			sessions: []
		});
		const ungrouped = {
			key: "__ungrouped__",
			title: ungroupedLabel,
			sessions: []
		};
		for (const session of sessions) {
			const workspace = owner.get(session.id);
			((workspace === void 0 ? ungrouped : buckets.get(workspace.workspaceId)) || ungrouped).sessions.push(session);
		}
		const groups = [...buckets.values()].filter((group) => group.sessions.length > 0);
		if (ungrouped.sessions.length > 0) groups.push(ungrouped);
		return groups.sort((left, right) => (right.sessions[0]?.updatedAt ?? 0) - (left.sessions[0]?.updatedAt ?? 0));
	}
	function projectLabel(path, fallback = "") {
		return String(path || "").replaceAll("\\", "/").replace(/\/+$/, "").split("/").filter(Boolean).slice(-2).join("/") || fallback;
	}
	function projectHue(identity) {
		let hash = 2166136261;
		for (const char of String(identity || "")) {
			hash ^= char.codePointAt(0);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0) * 137.508 % 360;
	}
	function relativeActivity(updatedAt, now, labels) {
		const elapsed = Math.max(0, now - updatedAt);
		if (elapsed < 6e4) return labels.now;
		const minutes = Math.floor(elapsed / 6e4);
		if (minutes < 60) return labels.minutes(minutes);
		const hours = Math.floor(elapsed / 36e5);
		if (hours < 24) return labels.hours(hours);
		const days = Math.floor(elapsed / 864e5);
		return labels.days(days);
	}
	//#endregion
	//#region client.source.js
	window.__ModuleLoader__.load({
		id: "dsh-bs-focus",
		factory(require) {
			const React = require("react");
			const h = React.createElement;
			const { useEffect, useMemo, useState } = React;
			const STORAGE_KEY = "dsh.focus-sessions.v1";
			const NS = "focusSessions";
			const dictionaries = {
				en: {
					title: "Sessions",
					focus: "Focus",
					standard: "Standard",
					period: "Activity",
					projects: "Group by project",
					projectLabels: "Project names",
					empty: "No sessions in this period",
					loading: "Loading sessions…",
					ungrouped: "No project",
					untitled: "Untitled",
					menu: "Session actions",
					states: {
						running: "Working",
						question: "Waiting for your answer",
						approval: "Waiting for approval",
						plan: "Waiting for plan review",
						unread: "Unread completion"
					},
					periods: {
						"3h": "3 часа",
						"6h": "6 часов",
						"1d": "1 день",
						"3d": "3 дня",
						all: "Все"
					},
					activity: {
						now: "just now",
						minutes: "{n} min ago",
						hours: "{n} hr ago",
						days: "{n} d ago"
					}
				},
				ru: {
					title: "Сессии",
					focus: "Фокус",
					standard: "Обычный",
					period: "Активность",
					projects: "Группировать по проектам",
					projectLabels: "Названия проектов",
					empty: "За этот период сессий нет",
					loading: "Загрузка сессий…",
					ungrouped: "Без проекта",
					untitled: "Без названия",
					menu: "Действия сессии",
					states: {
						running: "Работает",
						question: "Ждёт вашего ответа",
						approval: "Ждёт подтверждения",
						plan: "Ждёт проверки плана",
						unread: "Не прочитано"
					},
					periods: {
						"3h": "3 часа",
						"6h": "6 часов",
						"1d": "1 день",
						"3d": "3 дня",
						all: "Все"
					},
					activity: {
						now: "только что",
						minutes: "{n} мин назад",
						hours: "{n} ч назад",
						days: "{n} дн назад"
					}
				},
				zh: {
					title: "会话",
					focus: "专注",
					standard: "标准",
					period: "活动时间",
					projects: "按项目分组",
					projectLabels: "项目名称",
					empty: "该时间段内没有会话",
					loading: "正在加载会话…",
					ungrouped: "无项目",
					untitled: "未命名",
					menu: "会话操作",
					states: {
						running: "工作中",
						question: "等待您的回答",
						approval: "等待确认",
						plan: "等待计划审核",
						unread: "未读完成"
					},
					periods: {
						"3h": "3 小时",
						"6h": "6 小时",
						"1d": "1 天",
						"3d": "3 天",
						all: "全部"
					},
					activity: {
						now: "刚刚",
						minutes: "{n} 分钟前",
						hours: "{n} 小时前",
						days: "{n} 天前"
					}
				}
			};
			function readPreferences() {
				try {
					if (typeof localStorage === "undefined") return { ...DEFAULT_PREFERENCES };
					const raw = localStorage.getItem(STORAGE_KEY);
					return normalizePreferences(raw === null ? null : JSON.parse(raw));
				} catch {
					return { ...DEFAULT_PREFERENCES };
				}
			}
			function periodLabel(value) {
				return {
					"3h": "3 часа",
					"6h": "6 часов",
					"1d": "1 день",
					"3d": "3 дня",
					all: "Все"
				}[value] || value;
			}
			function writePreferences(value) {
				try {
					if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
				} catch {}
			}
			function ActivityText({ updatedAt, now }) {
				return relativeActivity(updatedAt, now, {
					now: "<1m",
					minutes: (n) => `${n}m`,
					hours: (n) => `${n}h`,
					days: (n) => `${n}d`
				});
			}
			function FocusSessionCard({ session, status, workspace, showProjectLabel, now, open, renderFactorySlot, t }) {
				const title = session.title || session.displayTitle || t("untitled");
				const project = workspace === void 0 ? null : projectLabel(workspace.path, workspace.title);
				const hue = workspace === void 0 ? 0 : projectHue(workspace.workspaceId || workspace.path);
				const pending = status?.pendingInteraction?.kind;
				const state = pending === "question" ? "question" : pending === "approval" ? "approval" : pending === "plan-review" ? "plan" : status?.running === true ? "running" : status?.completionUnread === true ? "unread" : null;
				return h("div", {
					className: `dfs-card${state === null ? "" : ` is-${state}`}`,
					role: "listitem",
					tabIndex: 0,
					"data-focus-session-id": session.id,
					"aria-label": state === null ? title : `${title}. ${t(`states.${state}`)}`,
					onClick: () => open(session.id),
					onKeyDown: (event) => {
						if (event.target !== event.currentTarget || event.key !== "Enter" && event.key !== " ") return;
						if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
						event.preventDefault();
						open(session.id);
					}
				}, h("span", { className: "dfs-card-copy" }, h("span", {
					className: "dfs-card-title",
					title
				}, title), h("span", { className: "dfs-card-meta" }, showProjectLabel && project && h("span", {
					className: "dfs-project-chip",
					title: workspace.path || workspace.title,
					style: { "--dfs-project-hue": hue }
				}, project), h("span", {
					className: "dfs-card-time",
					title: new Date(session.updatedAt).toLocaleString()
				}, h(ActivityText, {
					updatedAt: session.updatedAt,
					now
				}))), status?.completionUnread === true && h("span", { className: "dfs-unread-line" }, h("span", {
					className: "dfs-unread-dot",
					"aria-hidden": true
				}), t("states.unread"))), h("span", {
					className: "dfs-card-menu",
					onClick: (event) => event.stopPropagation()
				}, renderFactorySlot("contextMenu.button", {
					target: {
						kind: "session",
						value: {
							sessionId: session.id,
							displayTitle: session.title || ""
						}
					},
					label: t("menu", { name: title }),
					className: "dfs-menu-button"
				})));
			}
			function FocusLauncher({ wide, setEnabled, t }) {
				return h("button", {
					type: "button",
					className: `dfs-launcher${wide ? " is-wide" : ""}`,
					title: t("focus"),
					"aria-label": t("focus"),
					onClick: () => setEnabled(true)
				}, h("span", {
					className: "dfs-launcher-icon",
					"aria-hidden": true
				}, "◉"), wide && h("span", { className: "dfs-launcher-label" }, t("focus")));
			}
			function FocusBrowser(props) {
				const { wide, expandSidebar, useSessions, useSessionStatus, useWorkspaces, useSectionScroller, open, setFocusPreferences, renderFactorySlot, t } = props;
				const list = useSessions((state) => state);
				const statuses = useSessionStatus((state) => state);
				const workspaceState = useWorkspaces((state) => state);
				const loading = list.phase !== "ready" || workspaceState.phase !== "ready";
				const sectionScroller = useSectionScroller();
				const [prefs, setPrefs] = useState(readPreferences);
				const [periodOpen, setPeriodOpen] = useState(false);
				const [now, setNow] = useState(() => Date.now());
				useEffect(() => {
					const timer = window.setInterval(() => setNow(Date.now()), 6e4);
					return () => window.clearInterval(timer);
				}, []);
				const sessions = useMemo(() => visibleSessions(list, workspaceState.archivedSessionIds, prefs.period, now), [
					list,
					workspaceState.archivedSessionIds,
					prefs.period,
					now
				]);
				const sessionWorkspaces = useMemo(() => workspaceBySession(workspaceState.items), [workspaceState.items]);
				const groups = useMemo(() => prefs.showProjects ? groupSessions(sessions, workspaceState.items, t("ungrouped")) : [], [
					prefs.showProjects,
					sessions,
					workspaceState.items,
					t
				]);
				const patch = (next) => setPrefs((current) => {
					const value = {
						...current,
						...next
					};
					writePreferences(value);
					return value;
				});
				if (!wide) return h("button", {
					type: "button",
					className: "dfs-rail",
					"aria-label": t("focus"),
					title: t("focus"),
					onClick: expandSidebar
				}, h("span", { "aria-hidden": true }, "◉"));
				return h("section", {
					className: "dfs-root",
					"data-focus-sessions": ""
				}, h("header", { className: "dfs-toolbar" }, h("button", {
					type: "button",
					className: "dfs-tool-button",
					onClick: () => setFocusPreferences({
						...prefs,
						enabled: false
					}),
					title: t("standard"),
					"aria-label": t("standard")
				}, "←"), h("div", { className: "dfs-period" }, h("button", {
					type: "button",
					className: `dfs-period-button${periodOpen ? " is-open" : ""}`,
					"aria-label": t("period"),
					"aria-haspopup": "menu",
					"aria-expanded": periodOpen,
					onClick: () => setPeriodOpen((open) => !open),
					onKeyDown: (event) => {
						if (event.key === "Escape") {
							setPeriodOpen(false);
							event.currentTarget.focus();
						}
					}
				}, periodLabel(prefs.period), h("span", { "aria-hidden": true }, "⌄")), periodOpen && h("div", {
					className: "dfs-period-menu",
					role: "menu",
					onKeyDown: (event) => {
						if (event.key === "Escape") {
							setPeriodOpen(false);
							event.stopPropagation();
						}
					}
				}, [
					"3h",
					"6h",
					"1d",
					"3d",
					"all"
				].map((value) => h("button", {
					type: "button",
					role: "menuitemradio",
					"aria-checked": prefs.period === value,
					className: `dfs-period-option${prefs.period === value ? " is-selected" : ""}`,
					onClick: () => {
						patch({ period: value });
						setPeriodOpen(false);
					}
				}, h("span", {
					className: "dfs-period-check",
					"aria-hidden": true
				}, prefs.period === value ? "✓" : ""), periodLabel(value))))), h("button", {
					type: "button",
					className: `dfs-tool-button dfs-text-button${prefs.showProjects ? " is-active" : ""}`,
					"aria-pressed": prefs.showProjects,
					title: t("projects"),
					"aria-label": t("projects"),
					onClick: () => patch({ showProjects: !prefs.showProjects })
				}, "▦"), h("button", {
					type: "button",
					className: `dfs-tool-button dfs-text-button${prefs.showProjectLabels ? " is-active" : ""}`,
					"aria-pressed": prefs.showProjectLabels,
					title: t("projectLabels"),
					"aria-label": t("projectLabels"),
					onClick: () => patch({ showProjectLabels: !prefs.showProjectLabels })
				}, "Aa")), h("div", {
					className: "dfs-list",
					role: "list",
					ref: sectionScroller.bindScrollerRef
				}, loading ? h("div", {
					className: "dfs-empty",
					role: "status"
				}, t("loading")) : sessions.length === 0 ? h("div", { className: "dfs-empty" }, t("empty")) : prefs.showProjects ? groups.map((group) => h("section", {
					className: "dfs-group",
					key: group.key
				}, h("h3", {
					className: "dfs-group-title",
					title: group.title
				}, group.title), group.sessions.map((session) => h(FocusSessionCard, {
					key: session.id,
					session,
					status: statuses.get(session.id),
					workspace: sessionWorkspaces.get(session.id),
					showProjectLabel: prefs.showProjectLabels,
					now,
					open,
					renderFactorySlot,
					t
				})))) : sessions.map((session) => h(FocusSessionCard, {
					key: session.id,
					session,
					status: statuses.get(session.id),
					workspace: sessionWorkspaces.get(session.id),
					showProjectLabel: prefs.showProjectLabels,
					now,
					open,
					renderFactorySlot,
					t
				}))));
			}
			const css = `
      .dfs-root{display:flex;flex-direction:column;max-height:100cqh;min-height:0;color:var(--dsw-alias-label-primary);font-family:inherit}
      .dfs-root,.dfs-root *{box-sizing:border-box}
      .dfs-toolbar{height:40px;min-height:40px;display:flex;align-items:center;gap:5px;padding:5px var(--dsh-sidebar-row-padding,12px);border-bottom:1px solid var(--dsw-alias-border-l1)}
      .dfs-tool-button{height:28px;min-width:28px;padding:0 7px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
      .dfs-tool-button:hover,.dfs-tool-button.is-active{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}.dfs-tool-button:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
      .dfs-text-button{font-weight:600}.dfs-period{position:relative;min-width:0;flex:1;display:flex}.dfs-period-button{width:100%;height:28px;display:flex;align-items:center;justify-content:space-between;gap:7px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}.dfs-period-button:hover,.dfs-period-button.is-open{background:var(--dsw-alias-interactive-bg-hover)}.dfs-period-button:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
      .dfs-period-menu{position:absolute;z-index:30;top:32px;left:0;min-width:118px;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-overlay);box-shadow:0 8px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent)}.dfs-period-option{width:100%;height:28px;display:flex;align-items:center;gap:6px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer}.dfs-period-option:hover,.dfs-period-option:focus-visible,.dfs-period-option.is-selected{background:var(--dsw-alias-interactive-bg-hover);outline:none}.dfs-period-check{width:12px;color:var(--dsw-alias-brand-primary)}
      .dfs-list{min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:3px;padding:8px var(--dsh-sidebar-row-padding,12px) 10px;scrollbar-gutter:stable}
      .dfs-group{display:flex;flex-direction:column;gap:3px;margin:0 0 7px}
      .dfs-group-title{margin:4px 6px 3px;font-size:11px;line-height:16px;font-weight:600;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dfs-card{position:relative;min-height:48px;display:flex;align-items:center;gap:8px;padding:7px 6px 7px 9px;border:1px solid transparent;border-radius:9px;background:var(--dsw-alias-bg-base);cursor:pointer;user-select:none;overflow:hidden}
      .dfs-card:hover,.dfs-card:focus-visible{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1);outline:none}.dfs-card::before{content:"";position:absolute;left:0;top:5px;bottom:5px;width:3px;border-radius:0 3px 3px 0;background:transparent}.dfs-card.is-running{background:color-mix(in srgb,#4387f7 23%,var(--dsw-alias-bg-base))}.dfs-card.is-running::before{background:#5b9aff;animation:dfs-running-pulse 1.4s ease-in-out infinite}.dfs-card.is-question{background:color-mix(in srgb,#e8872b 23%,var(--dsw-alias-bg-base))}.dfs-card.is-question::before{background:#f09a49}.dfs-card.is-approval{background:color-mix(in srgb,#d9ad22 23%,var(--dsw-alias-bg-base))}.dfs-card.is-approval::before{background:#e5be3e}.dfs-card.is-plan{background:color-mix(in srgb,#26a8a2 23%,var(--dsw-alias-bg-base))}.dfs-card.is-plan::before{background:#3fc0b9}.dfs-card.is-unread{background:color-mix(in srgb,#38a866 23%,var(--dsw-alias-bg-base))}.dfs-card.is-unread::before{background:#55c27a}.dfs-card.is-running:hover,.dfs-card.is-question:hover,.dfs-card.is-approval:hover,.dfs-card.is-plan:hover,.dfs-card.is-unread:hover{filter:saturate(1.18) brightness(1.04)}
      .dfs-card-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}.dfs-card-meta{min-width:0;display:flex;align-items:center;gap:6px}
      .dfs-project-chip{min-width:0;max-width:calc(100% - 34px);padding:1px 5px;border-radius:4px;background:hsl(var(--dfs-project-hue) 66% 82%);color:hsl(var(--dfs-project-hue) 52% 22%);font-size:10px;line-height:15px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dfs-card-title{min-width:0;font-size:13px;line-height:17px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dfs-card-time{flex:none;margin-left:auto;font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}.dfs-unread-line{display:flex;align-items:center;gap:5px;color:#55c27a;font-size:10px;line-height:14px;font-weight:650;text-transform:uppercase;letter-spacing:.04em}.dfs-unread-dot{width:6px;height:6px;flex:none;border-radius:50%;background:currentColor;box-shadow:0 0 0 2px color-mix(in srgb,currentColor 18%,transparent)}
      .dfs-card-menu{display:flex;align-items:center;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease}
      .dfs-card:hover .dfs-card-menu,.dfs-card:focus-within .dfs-card-menu{opacity:1;visibility:visible;pointer-events:auto}
      .dfs-menu-button{width:26px!important;height:26px!important;min-width:26px!important;padding:0!important;border:0!important;border-radius:7px!important;background:transparent!important;color:var(--dsw-alias-label-tertiary)!important;box-shadow:none!important}
      .dfs-menu-button:hover,.dfs-menu-button:focus-visible{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important;outline:none!important}
      .dfs-menu-button svg{width:16px!important;height:16px!important}
      .dfs-empty{padding:28px 10px;text-align:center;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
      .dfs-rail{width:36px;height:36px;margin:0 auto;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}
      .dfs-rail:hover,.dfs-rail:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);outline:none}
      .dfs-launcher{width:36px;height:36px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}
      .dfs-launcher.is-wide{width:100%;justify-content:flex-start;padding:0 10px}
      .dfs-launcher:hover,.dfs-launcher:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);outline:none}
      .dfs-launcher-icon{width:16px;flex:none;text-align:center}.dfs-launcher-label{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      body[data-ds-dark-theme] .dfs-project-chip{background:hsl(var(--dfs-project-hue) 46% 30%);color:hsl(var(--dfs-project-hue) 78% 88%)}
      @keyframes dfs-running-pulse{0%,100%{opacity:.45}50%{opacity:1}}
      @media (hover:none){.dfs-card-menu{opacity:1;visibility:visible;pointer-events:auto}.dfs-card{min-height:52px}}
      @media (prefers-reduced-motion:reduce){.dfs-card-menu{transition:none}.dfs-card.is-running::before{animation:none}}
    `;
			return {
				inject: [
					"slots",
					"locale",
					"uiWorkspace"
				],
				apply(ctx) {
					ctx.effect(() => {
						const style = document.createElement("style");
						style.dataset.dshFocusSessions = "";
						style.textContent = css;
						document.head.appendChild(style);
						return () => style.remove();
					}, "focus sessions styles");
					ctx.effect(() => ctx.locale.register(NS, dictionaries), "focus sessions locale");
					let disposeFocus = null;
					const setFocusPreferences = (value) => {
						writePreferences(value);
						sync();
					};
					const setEnabled = (enabled) => setFocusPreferences({
						...readPreferences(),
						enabled
					});
					const registerFocus = () => ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
						name: "sidebar.workspaces",
						priority: -100,
						locale: NS,
						inject: () => ({
							open: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
							setFocusPreferences
						})
					}, FocusBrowser));
					const sync = () => {
						const enabled = readPreferences().enabled;
						if (enabled && disposeFocus === null) disposeFocus = registerFocus();
						else if (!enabled && disposeFocus !== null) {
							disposeFocus();
							disposeFocus = null;
						}
					};
					sync();
					const disposeLauncher = ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
						name: "sidebar.footer.action",
						id: "focus-sessions",
						order: -100,
						locale: NS,
						inject: () => ({ setEnabled })
					}, FocusLauncher));
					const onStorage = (event) => {
						if (event.key === STORAGE_KEY) sync();
					};
					window.addEventListener("storage", onStorage);
					return () => {
						disposeLauncher();
						window.removeEventListener("storage", onStorage);
						if (disposeFocus !== null) disposeFocus();
					};
				}
			};
		}
	});
	//#endregion
})();
