#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────
# Agentic Cadence Installer for Claude Code
# ─────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve to monorepo root (packages/claude → ../../)
MONOREPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CLAUDE_DIR="${HOME}/.claude"
RULES_DIR="${CLAUDE_DIR}/rules/common"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── Hardened sed substitution helpers ───────────────
# Why: sed's replacement string treats `&` as a backreference to the whole
# match and `\N` (N=0-9) as numbered backreferences. A vault path containing
# `&`, `\`, or the chosen delimiter would silently corrupt the substitution
# output. The canonical fix is to (a) escape metacharacters in the
# replacement string and (b) choose a delimiter that cannot appear in any
# realistic filesystem path. See GNU sed manual §3.3 and POSIX.1-2017 sed.
#
# Order-sensitive: `\` MUST be escaped FIRST so any subsequent `\N` digit
# pair cannot re-form as a backreference after partial escaping.

# Escape a string for safe use as the RHS of `sed s...`.
# Uses $'\x01' (SOH) as the sed delimiter, so we escape it defensively
# even though no realistic path contains it.
escape_sed_replacement() {
    printf '%s' "$1" \
        | sed -e 's/\\/\\\\/g' \
              -e 's/&/\\&/g' \
              -e $'s/\x01/\\\\\x01/g'
}

# Reject vault paths containing newline or carriage return.
# Newline breaks sed's s-command delimiter even when SOH is used (sed
# operates line-by-line and treats \n as the line boundary). CR (\r) is
# easy to smuggle in via a Windows clipboard paste where `read -r` strips
# the trailing \n but leaves the \r attached.
#
# NUL is not checked here because bash strings are NUL-terminated — if the
# env var or user input contained a NUL byte, bash would have truncated it
# at import time. There is no state in which `validate_vault_path` could
# receive a NUL-bearing string; the check would either fail to match (if
# the string is truncated) or match the empty pattern (spuriously rejecting
# all paths).
validate_vault_path() {
    local path="$1"
    case "$path" in
        *$'\n'*) error "Vault path contains a newline character — not a valid path." ;;
        *$'\r'*) error "Vault path contains a carriage return — remove CR (likely from a Windows clipboard paste) and retry." ;;
    esac
}

echo ""
echo "  Agentic Cadence for Claude Code"
echo "  ─────────────────────────────────"
echo ""

# ── Step 0: Build if needed ──────────────────────────
if [ ! -f "${SCRIPT_DIR}/rules/obsidian-workflow.md" ]; then
  echo "Building from shared core..."
  (cd "$MONOREPO_ROOT" && node shared/build.mjs claude)
  echo ""
fi

# ── Step 1: Vault location ──────────────────────────
DEFAULT_VAULT="${OBSIDIAN_VAULT_PATH:-}"
if [[ -z "$DEFAULT_VAULT" ]]; then
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        DEFAULT_VAULT="C:\\Obsidian_Vaults"
    elif [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
        # WSL: $OSTYPE is linux-gnu but the vault often lives on the
        # Windows side at /mnt/c/... so it's reachable from both WSL and
        # Windows-side Obsidian. User can override at the prompt.
        DEFAULT_VAULT="/mnt/c/Obsidian_Vaults"
    else
        DEFAULT_VAULT="${HOME}/Obsidian_Vaults"
    fi
fi

read -rp "Obsidian vault path [${DEFAULT_VAULT}]: " VAULT_PATH
VAULT_PATH="${VAULT_PATH:-$DEFAULT_VAULT}"

# Reject obviously-invalid paths before sed, mkdir, or anything else.
validate_vault_path "$VAULT_PATH"

if [[ ! -d "$VAULT_PATH" ]]; then
    read -rp "Directory doesn't exist. Create it? [Y/n]: " CREATE
    if [[ "${CREATE:-Y}" =~ ^[Yy]$ ]]; then
        mkdir -p "$VAULT_PATH"
        info "Created vault at $VAULT_PATH"
    else
        error "Vault directory required. Aborting."
    fi
fi

# ── Step 2: Copy rules (built from shared core) ─────
mkdir -p "$RULES_DIR"

# Update vault path in rules before copying. Uses SOH (\x01) as the sed
# delimiter to avoid any delimiter collision with user-supplied paths,
# and escapes \, &, and the delimiter in the replacement string.
# The SED_EXPR assignment keeps the quoting consolidated in one place so
# future maintainers aren't tempted to rewrap the three-word concatenation.
ESCAPED_VAULT="$(escape_sed_replacement "$VAULT_PATH")"
SED_EXPR=$'s\x01C:\\\\Obsidian_Vaults\x01'"${ESCAPED_VAULT}"$'\x01g'
sed "$SED_EXPR" \
    "${SCRIPT_DIR}/rules/obsidian-workflow.md" > "${RULES_DIR}/obsidian-workflow.md"
cp "${SCRIPT_DIR}/rules/git-workflow.md" "${RULES_DIR}/git-workflow.md"

info "Installed workflow rules to ${RULES_DIR}/"

# ── Step 3: Copy vault templates from shared ─────────
TEMPLATES_DIR="${VAULT_PATH}/_Templates"
mkdir -p "$TEMPLATES_DIR"

# Enable nullglob so an empty or missing templates dir doesn't make the
# glob expand to its literal pattern string (which would then be passed
# to `cp` and crash the installer under `set -e` with an opaque error).
shopt -s nullglob
template_count=0
for tmpl in "${MONOREPO_ROOT}"/shared/templates/vault/*.md; do
    cp "$tmpl" "${TEMPLATES_DIR}/$(basename "$tmpl")"
    # Avoid `((template_count++))` — the post-increment form returns the OLD
    # value as exit status, which is 0 on the first iteration, which bash
    # interprets as "expression evaluated to zero" → exit status 1 → `set -e`
    # aborts the script. Classic bash arithmetic-expansion gotcha.
    template_count=$((template_count + 1))
done
shopt -u nullglob

if [[ "$template_count" -eq 0 ]]; then
    warn "No vault templates found at ${MONOREPO_ROOT}/shared/templates/vault/ — did you forget to run 'npm run build'?"
else
    info "Installed vault templates to ${TEMPLATES_DIR}/ (${template_count} files)"
fi

# ── Step 4: Create dashboard if missing ──────────────
DASHBOARD="${VAULT_PATH}/_Dashboard.md"
if [[ ! -f "$DASHBOARD" ]]; then
    cat > "$DASHBOARD" <<'EOF'
# Project Dashboard

## Active Projects

(Run `/cadence:init <project-name>` in Claude Code to add a project)

## Templates
- [[_Templates/Epic-template|Epic]]
- [[_Templates/Story-template|Story]]
- [[_Templates/Feature-Spec-template|Feature Spec]]
- [[_Templates/Technical-Spec-template|Technical Spec]]
- [[_Templates/Spike-template|Spike/Research]]
- [[_Templates/Board-template|Sprint Board]]
- [[_Templates/Backlog-template|Product Backlog]]
EOF
    info "Created dashboard at ${DASHBOARD}"
else
    warn "Dashboard already exists, skipping"
fi

# ── Step 5: Add additionalDirectories to settings ────
SETTINGS="${CLAUDE_DIR}/settings.json"
if [[ -f "$SETTINGS" ]]; then
    if grep -q "additionalDirectories" "$SETTINGS"; then
        warn "additionalDirectories already configured in settings.json"
    else
        warn "Add this to your ${SETTINGS} under 'permissions':"
        echo ""
        echo "  \"permissions\": {"
        echo "    \"additionalDirectories\": [\"${VAULT_PATH}\"]"
        echo "  }"
        echo ""
    fi
else
    warn "No settings.json found at ${SETTINGS}. Create it with:"
    echo ""
    echo "  {"
    echo "    \"permissions\": {"
    echo "      \"additionalDirectories\": [\"${VAULT_PATH}\"]"
    echo "    },"
    echo "    \"worktree\": {"
    echo "      \"symlinkDirectories\": [\"node_modules\", \".venv\", \".cache\"]"
    echo "    }"
    echo "  }"
    echo ""
fi

# ── Step 6: Plugin installation hint ─────────────────
echo ""
echo "  ─────────────────────────────────────────────"
echo ""
echo "  Install as Claude Code plugin (for skills):"
echo ""
echo "    claude --plugin-dir ${SCRIPT_DIR}"
echo ""
echo "  Available commands after install:"
echo "    /cadence:init <project>   — Initialize a new project"
echo "    /cadence:board            — Show sprint board status"
echo "    /cadence:interview <desc> — Socratic interview before story"
echo "    /cadence:story <desc>     — Create a user story"
echo "    /cadence:sprint           — Manage sprints"
echo "    /cadence:pickup [story]   — Pick up a story + worktree"
echo "    /cadence:done             — Complete story + PR"
echo "    /cadence:review           — Run automated review"
echo "    /cadence:spike <question> — Research spike"
echo ""
echo "  Rules are built from shared/core.md — run 'npm run build' to regenerate."
echo ""
info "Installation complete!"
