export interface ArchitectureRuleOptions {
  readonly sourceFolder: string;
  readonly layers: {
    readonly domain: Layer;
    readonly application: Layer;
    readonly infrastructure: Layer;
  };
  readonly ignoreTypeImports: boolean;
  readonly ignoreExternalDependencies: boolean;
}

interface Layer {
  readonly aliases: readonly string[];
  readonly allowedDependencies: readonly string[];
}

export const architectureRuleOptions: ArchitectureRuleOptions;

export const coreImportRestrictions: {
  readonly patterns: readonly {
    readonly group: readonly string[];
    readonly message: string;
  }[];
};
