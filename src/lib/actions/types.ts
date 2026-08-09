/**
 * What every host-side server action resolves to.
 *
 * A plain module rather than part of an action file: a `"use server"` module
 * turns each of its exports into a callable endpoint, and a type is not a thing
 * anyone should be able to POST to.
 */
export interface ActionState {
  error?: string;
  ok?: boolean;
}
