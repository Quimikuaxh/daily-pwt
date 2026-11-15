/** El contenido y las interacciones son los del diario; el marco, las barras y las placas son las de UnovaSide. */
import type { CSSProperties } from 'react'
import { SidePanel, type SidePanelProps } from '../battle/side/SidePanel'
import { UnovaTitle } from './UnovaTitle'
import { unovaVars } from './unovaRoute'
import { uiAsset } from '../common/uiAssets'
import './unova.css'
import './unovaBattle.css'

export function UnovaBattleSide(props: SidePanelProps) {
  return <SidePanel {...props} presentation={{
    title: <UnovaTitle x={0} y={0} width={156} title={props.title} />,
    style: { ...unovaVars(), '--unova-bench': `url("${uiAsset('party/panel-blue-left.png')}")` } as CSSProperties,
  }} />
}
