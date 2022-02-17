import { TestContract } from "../../tests/utils/test-contract";
import { TestContractService } from "../../tests/utils/test-contract-service";
import { CompilerServiceMock } from "./compiler.service.mock";
import { NodeService } from "./node.service";
import { ProcessorService } from "./processor.service";
import { StateService } from "./state.service";
import { VerificationService } from "./verification.service";

describe('ProcessorService', () => {
  let tcontractService: TestContractService;
  let tcontracts: TestContract[];
  let processorService: ProcessorService;

  beforeEach(async () => {
    tcontractService = new TestContractService();
    tcontracts = await tcontractService.getTestCases();
    processorService = new ProcessorService(
      new StateService(),
      new CompilerServiceMock(tcontracts),
      new VerificationService(new NodeService())
    );
  });

  it('should work', async () => {
    await processorService.process(
      tcontracts,
      {
        concurrency: 5,
        failFast: true,
        jump: 0,
        save: false,
        skip: false,
      },
    );
    // expect not to have errored
    expect(true).toBeTruthy();

    // allow for extra time because it has to hit the eth node currently...
    // TODO: mock hitting the eth node
  }, 30_000);

  // TODO: test failure cases

  // it('should work', () => {
  //   processorService.process(tcontracts, { concurrency: 5, failFast})
  // });
});