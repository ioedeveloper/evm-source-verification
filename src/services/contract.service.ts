import fs from 'node:fs';
import path from 'node:path';
// TODO: resolve circular import
// eslint-disable-next-line import/no-cycle
import { matchContractFiles, MatchedChains, MatchedContracts } from '../libs/contracts.match';
import { fabs, fexists, writeJsonFile } from "../libs/utils";
import {
  ContractConfig,
  ContractFileMatch,
  ContractInput,
  ContractIdentity,
  HasChainId,
  VerifiedMetadata,
} from "../types";


/**
 * Provides access to contracts
 */
export interface IContractService {
  /**
   * Basename of a config file
   * eg. "config.json"
   */
  readonly configBasename: string,

  /**
   * Basename of an input file
   * eg. "input.json"
   */
  readonly inputBasename: string;

  /**
   * Basename of a metadata file
   * eg. "metadata.json"
   */
  readonly metadataBasename: string;

  /**
   * Get all saved contracts
   *
   * @returns           all contracts for all chains
   */
  getContracts(): Promise<MatchedChains>

  /**
   * Get all saved for the chain
   *
   * @param identity    identity of the chain
   * @returns           all contracts the chain
   */
  getChainContracts(identity: HasChainId): Promise<MatchedContracts>

  /**
   * Save contract metadtata
   *
   * @param identity    info specifying the contract
   * @param metadata    the metadata to save
   */
  saveMetadata(identity: ContractIdentity, metadata: VerifiedMetadata): Promise<void>;


  /**
   * Does the contract have a metadata stored?
   *
   * @param identity    info specifying the contract
   * @returns           whether the contract has a metadata file
   */
  hasMetadata(identity: ContractIdentity): Promise<boolean>;


  /**
   * Get the JSON Config of the contract
   *
   * @param identity  info specifying the contract
   */
  getConfig(identity: ContractIdentity): Promise<ContractConfig>;


  /**
   * Get the JSON Input of the contract
   *
   * @param identity  info specifying the contract
   */
  getInput(identity: ContractIdentity): Promise<ContractInput>;


  /**
   * Extract info specifying the contract from a file or directory path
   *
   * @param filename    file or dir name with the contract
   * @returns           contract info if match was successful
   */
  match(filename: string): null | ContractFileMatch;
}


/**
 * Configuration options for the ContractService
 */
export interface ContractServiceOptions {
  /**
   * directory with the application's contracts
   *
   * @example "contracts"
   */
  dirname?: string;

  /**
   * basename part of the compiler's config filename
   *
   * @example "config.json"
   */
  configBasename?: string;

  /**
   * basename part of the compiler's input filename
   *
   * @example "input.json"
   */
  inputBasename?: string;

  /**
   * basename part of the verified output filename
   *
   * @example "metadata.json"
   */
  metadataBasename?: string;
}

/**
 * @inheritdoc
 */
export class ContractService implements IContractService {
  public static DEFAULTS = {
    DIRNAME: 'contracts',
    CONFIG_BASENAME: 'configs.json',
    INPUT_BASENAME: 'input.json',
    METADATA_BASENAME: 'metadata.json',
  }


  /**
   * Absolute directory name of the application's contracts
   *
   * @see ContractServiceOptions.dirname
   */
  public readonly dirname: string;


  /**
   * @see ContractServiceOptions.configBasename
   */
  public readonly configBasename: string;


  /**
   * @see ContractServiceOptions.inputBasename
   */
  public readonly inputBasename: string;


  /**
   * @see ContractServiceOptions.metadataBasename
   */
  public readonly metadataBasename: string;


  /**
   * @param options   configuration of the ContractService
   */
  constructor(options?: ContractServiceOptions) {
    this.dirname = options?.dirname
      ?? ContractService.DEFAULTS.DIRNAME;

    this.configBasename = options?.configBasename
      ?? ContractService.DEFAULTS.CONFIG_BASENAME;

    this.inputBasename = options?.inputBasename
      ?? ContractService.DEFAULTS.INPUT_BASENAME;

    this.metadataBasename = options?.metadataBasename
      ?? ContractService.DEFAULTS.METADATA_BASENAME;
  }


  /** @see IContractService.getContracts */
  async getContracts(): Promise<MatchedChains> {
    const rootdir = this.dirname;

    const addressDirnames = await fs
        .promises
        // get chain dirents
        .readdir(rootdir, { withFileTypes: true })
        .then(chainDirs => Promise.all(chainDirs.map(async chainDir => {
            // expand chain dirname
            const chainDirname = path.join(rootdir, chainDir.name);

            // get address dirents
            const addrDirs = await fs
              .promises
              .readdir(chainDirname, { withFileTypes: true })

            // expand address dirnames
            const addrDirnames = addrDirs.map(addrDir => path.join(
              chainDirname,
              addrDir.name,
            ));
            return addrDirnames;
          })))
        // flatten 2d chainIds-addresses
        .then(chainAddrDirnames => chainAddrDirnames.flat())

    const matches = matchContractFiles(addressDirnames, this, {});

    return matches;
  }


  /** @see IContractService.getChainContracts */
  async getChainContracts(
    identity: HasChainId,
  ): Promise<MatchedContracts> {
    const chainDir = this.getChainDirname(identity);

    const dirs = await fs
      .promises
      .readdir(
        chainDir,
        { withFileTypes: true }
      )

    const dirnames = dirs.map(dir => path.join(chainDir, dir.name));

    const matches = matchContractFiles(dirnames, this, {});

    const contracts: MatchedContracts = matches
      .get(identity.chainId)
      ?.contracts ?? new Map();

    return contracts;
  }


  /** @see IContractService.saveMetadata */
  async saveMetadata(
    identity: ContractIdentity,
    metadata: VerifiedMetadata,
  ): Promise<void> {
    await writeJsonFile(
      this.getMetadataFilename(identity),
      metadata,
      { pretty: true },
    );
  }


  /** @see IContractService.hasMetadata} */
  hasMetadata(identity: ContractIdentity): Promise<boolean> {
    return fexists(this.getMetadataFilename(identity));
  }



  /** @see IContractService.getConfig} */
  getConfig(identity: ContractIdentity): Promise<ContractConfig> {
    const configFilename = this.getConfigFilename(identity);
    return fs
      .promises
      .readFile(fabs(configFilename))
      // TODO: assert file contains valid utf-8
      .then(buf => buf.toString('utf-8'))
      .then(JSON.parse.bind(JSON));
  }



  /** @see IContractService.getInput */
  getInput(identity: ContractIdentity): Promise<ContractInput> {
    const inputFilename = this.getInputFilename(identity);
    return fs
      .promises
      .readFile(fabs(inputFilename))
      // TODO: assert file contains valid utf-8
      .then(buf => buf.toString('utf-8'))
      .then(JSON.parse.bind(JSON));
  }


  /** @see IContractService.match */
  match(str: string): null | ContractFileMatch {
    const { dirname } = this;
    const regex = new RegExp(`^(${dirname}\\/([0-9]+)\\/(0x[a-f0-9]{40}))(\\/.*|$)`);
    const rmatch = str.match(regex);
    if (!rmatch) return null;
    const [, rdir, rchainId, raddress, rsubpath] = rmatch;
    return {
      original: str,
      dir: rdir,
      chainId: rchainId.startsWith('0x')
        ? parseInt(rchainId, 16)
        : parseInt(rchainId, 10),
      address: raddress,
      subpath: rsubpath,
    }
  }


  /**
   * Get the absolute fs directory location of a contract chain with the given
   * chainId
   * 
   * @param identity    chain's identity
   * @returns           relative contract's directory for this chain
   */
  getChainDirname(identity: HasChainId): string {
    return path.join(
      this.dirname,
      identity.chainId.toString(),
    );
  }


  /**
   * Get the absolute fs directory location of a contract with the given
   * chainId and address
   * 
   * @param options   contract's identity
   * @returns         contract's relative fs directory
   */
  getAddressDirname(options: ContractIdentity): string {
    return path.join(
      this.getChainDirname({ chainId: options.chainId }),
      options.address,
    );
  }


  /**
   * Get the absolute fs location of a contract's config.json
   * 
   * @param identity    contract identity
   * @returns           contract's config filename
   */
  getConfigFilename(identity: ContractIdentity): string {
    return path.join(
      this.getAddressDirname(identity),
      this.configBasename,
    );
  }


  /**
   * Get the absolute fs location of a contract's input.json
   * 
   * @param identity    contract identity
   * @returns           contract's input filename
   */
  getInputFilename(identity: ContractIdentity): string {
    return path.join(
      this.getAddressDirname(identity),
      this.inputBasename,
    );
  }


  /**
   * Get the absolute fs location of the contract's verified metadata file
   *
   * @param identity    contract identity
   * @returns           contract's metadata filename
   */
  getMetadataFilename(identity: ContractIdentity): string {
    return path.join(
      this.getAddressDirname(identity),
      this.metadataBasename,
    );
  }
}