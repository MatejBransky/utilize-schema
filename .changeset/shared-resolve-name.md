---
'@utilize/json-schema': minor
---

Export the naming helpers the generators share: `resolveName`, `resolveExplicitName`, `generateName`, `toSafeString`, `justName`, `stripExtension`, `mapName`, `mapDeclarationNames` and `allocateName`, with the `CustomNameResolver`, `NameMapper`, `ResolveNameOptions`, `DeclarationNames`, `MapDeclarationNamesOptions` and `MappedDeclarationNames` types. Zod, Effect and TypeScript each had their own copy; they now use these. The generators still export the same names as before.
