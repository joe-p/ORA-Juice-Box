import { Contract } from '@algorandfoundation/tealscript';

/** Information about a juicer */
type JuicerInfo = {
  /** The total amount juiced (fees burnt) */
  juiced: number;
  /** Whether this juicer has claimed their ORA for the given epoch */
  claimed: boolean;
};

/** Key used to indetify a juicer for a given epoch */
type JuicerID = {
  /** The address of the juicer */
  address: Address;
  /** The epoch */
  epoch: number;
};

/** An epoch is some period of Algorand rounds where the app earns ORA */
type Epoch = {
  /** The ORA round this epoch started */
  start: number;
  /** The ORA round this epoch ended. 0 indicates the epoch is ongoing */
  end: number;
  /** The total amount juiced (burnt fees) */
  totalJuiced: number;
  /** The total number of ORA mined this epoch */
  mined: number;
};

export class JuiceBox extends Contract {
  /** App ID of the ORA contract */
  orangeApp = GlobalStateKey<Application>();

  /** ASA ID of the ORA token */
  orangeAsa = GlobalStateKey<Asset>();

  /** How much a given address has juiced for a given epoch */
  juicers = BoxMap<JuicerID, JuicerInfo>();

  /** The total amount that has been juiced for the current epoch */
  epochs = BoxMap<number, Epoch>();

  /** The current epoch */
  epoch = GlobalStateKey<number>();

  /** The total ORA earned in past epochs */
  totalOra = GlobalStateKey<number>();

  createApplication(app: Application, asa: Asset): void {
    this.orangeApp.value = app;
    this.orangeAsa.value = asa;
  }

  optIntoORA(): void {
    sendAssetTransfer({
      xferAsset: this.orangeAsa.value,
      assetAmount: 0,
      assetReceiver: this.app.address,
    });
  }

  /**
   * Mine ORA
   *
   * @param mbrAndFeePayment Payment to this app that covers the juice fee and any necessary MBRs
   * @param to The address to mine on behalf of
   * @param _oraApp ORA application (for reference)
   */
  mine(
    mbrAndFeePayment: PayTxn,
    to: Address,
    // eslint-disable-next-line no-unused-vars
    _oraApp: Application
  ): void {
    verifyPayTxn(mbrAndFeePayment, { receiver: this.app.address });

    const juicer: JuicerID = {
      epoch: this.epoch.value,
      address: to,
    };

    let juiceAmount = mbrAndFeePayment.amount;

    if (!this.juicers(juicer).exists) {
      const preMBR = this.app.address.minBalance;
      this.juicers(juicer).value = { juiced: 0, claimed: false };
      juiceAmount = juiceAmount - (this.app.address.minBalance - preMBR);
    }

    if (!this.epochs(this.epoch.value).exists) {
      const preMBR = this.app.address.minBalance;
      this.epochs(this.epoch.value).value = {
        start: globals.round,
        end: 0,
        totalJuiced: 0,
        mined: 0,
      };
      juiceAmount = juiceAmount - (this.app.address.minBalance - preMBR);
    }

    sendMethodCall<[Address], void>({
      name: 'mine',
      applicationID: this.orangeApp.value,
      methodArgs: [this.app.address],
      fee: juiceAmount,
    });

    // By incrementing by the payment amount (instead of juiceAmount),
    // the cost of the MBRs is spread across all juicers
    this.juicers(juicer).value.juiced += mbrAndFeePayment.amount;
    this.epochs(this.epoch.value).value.totalJuiced += mbrAndFeePayment.amount;
  }

  /**
   * End the current epoch
   */
  private endEpoch(): void {
    const oraMined = this.totalOra.value - this.app.address.assetBalance(this.orangeAsa.value);
    assert(oraMined);

    this.epochs(this.epoch.value).value.end = globals.round;
    this.epochs(this.epoch.value).value.mined = oraMined;
    this.totalOra.value += oraMined;
    this.epoch.value += 1;
  }

  /**
   * Claim ORA proportional to the amount juiced in the given epoch
   * @param epoch The epoch to claim from
   * @param to The address to send the ORA to
   * @param _ora The ORA asset ID (for reference)
   */
  claim(
    epoch: number,
    to: Address,
    // eslint-disable-next-line no-unused-vars
    _ora: Asset
  ): void {
    const juicer: JuicerID = {
      epoch: epoch,
      address: to,
    };

    if (this.epochs(epoch).value.end === 0) this.endEpoch();

    // Ensure there is no double claiming
    assert(!this.juicers(juicer).value.claimed);

    const juicerInfo = this.juicers(juicer).value;
    const epochInfo = this.epochs(epoch).value;

    const amount = wideRatio([juicerInfo.juiced, epochInfo.mined], [epochInfo.totalJuiced]);

    this.juicers(juicer).value.claimed = true;

    sendAssetTransfer({
      xferAsset: this.orangeAsa.value,
      assetAmount: amount,
      assetReceiver: to,
    });
  }
}
