import type { Register } from 'claude-code'

// 專案資料夾名稱含這些字 → 用這個顏色。要加專案就在這裡加一行。
const RULES: { match: string; label: string; color: string }[] = [
  { match: '呆球', label: '呆球影片', color: '#1d4ed8' }, // 藍
  { match: '百家樂', label: '百家樂', color: '#b91c1c' }, // 紅
]

// 沒列在上面的專案：依資料夾名稱自動配一個固定顏色
const FALLBACK = ['#047857', '#7c3aed', '#c2410c', '#0e7490', '#a21caf', '#4d7c0f']

type Pick = { label: string; color: string }

function pickFor(root: string): Pick {
  const name = root.split(/[\\/]/).filter(Boolean).pop() ?? root
  const rule = RULES.find(r => root.includes(r.match))
  if (rule) return { label: rule.label, color: rule.color }
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return { label: name, color: FALLBACK[hash % FALLBACK.length]! }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const { color, label } = pickFor(await $.session.root())
    // 桌面版：整個視窗背後鋪上專案色，面板半透明讓顏色透出來
    const res = await $.theme.set({
      backdrop: {
        id: 'project-color',
        glass: { blur: 0, tint: '#0b0b0b', opacity: 0.3 },
        colorScheme: 'dark',
      },
    })
    // 暫時：把底色有沒有畫出來顯示在狀態列，方便除錯
    $.ui.status(res.isDrawn ? `● ${label}` : `● ${label}（底色沒畫：${res.reason}）`)
    return next(e)
  })

  // 視窗底色
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== 'window-color') return next(e)
    const { color } = pickFor(await $.session.root())
    const { Box } = $.ui.resolve(e)
    return <Box width="100%" height="100%" backgroundColor={color} />
  })

  // 輸入框上方的色帶（終端機版也看得到）
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { color, label } = pickFor(await $.session.root())
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box backgroundColor={color} paddingX={1} width="100%">
        <Text color="#ffffff" bold>
          ■ {label}
        </Text>
      </Box>
    )
  })
}
