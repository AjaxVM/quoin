export type TKind = 'base' | 'composite'
export type TType = 'resolver' | 'mutator' | 'iterativeResolver'

export interface IInfo {
  name: string
  kind: TKind
  type: TType
}
