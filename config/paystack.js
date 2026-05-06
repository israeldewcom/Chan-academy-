const fetch = require('node-fetch');
const crypto = require('crypto');
const logger = require('./logger');

class PaystackService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseUrl = 'https://api.paystack.co';
    this.webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
    this.splitCode = process.env.PAYSTACK_SPLIT_CODE;
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: this.getHeaders(),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok) {
        logger.error(`Paystack API error [${duration}ms] ${endpoint}:`, {
          status: response.status,
          message: data.message,
          data,
        });
        throw new Error(data.message || 'Paystack API request failed');
      }

      logger.info(`Paystack API success [${duration}ms] ${endpoint}`);

      return data;
    } catch (error) {
      if (error.message.includes('Paystack API request failed')) {
        throw error;
      }
      logger.error(`Paystack request failed: ${endpoint}`, error);
      throw new Error('Payment service temporarily unavailable');
    }
  }

  /**
   * Initialize a transaction
   * @param {string} email - Customer email
   * @param {number} amount - Amount in kobo (NGN) or pesewas (GHS)
   * @param {object} metadata - Additional data
   * @param {string} callbackUrl - Redirect URL after payment
   * @param {string} currency - Currency code (NGN, GHS, USD)
   * @returns {Promise<object>} Transaction initialization data
   */
  async initialize(email, amount, metadata = {}, callbackUrl = null, currency = 'NGN') {
    if (amount < 100) {
      throw new Error('Amount must be at least 1 NGN (100 kobo)');
    }

    const body = {
      email,
      amount,
      currency,
      metadata: {
        ...metadata,
        platform: 'ChangeX Academy',
        custom_fields: [
          {
            display_name: 'Platform',
            variable_name: 'platform',
            value: 'ChangeX Academy',
          },
        ],
      },
    };

    if (callbackUrl) {
      body.callback_url = callbackUrl;
    }

    if (this.splitCode) {
      body.split_code = this.splitCode;
    }

    try {
      const response = await this.makeRequest('/transaction/initialize', 'POST', body);

      logger.info(`💳 Transaction initialized: ${response.data.reference}`, {
        email,
        amount: amount / 100,
        currency,
      });

      return {
        success: true,
        reference: response.data.reference,
        authorizationUrl: response.data.authorization_url,
        accessCode: response.data.access_code,
      };
    } catch (error) {
      logger.error('Paystack initialization error:', error);
      throw error;
    }
  }

  /**
   * Verify a transaction
   * @param {string} reference - Transaction reference
   * @returns {Promise<object>} Verification result
   */
  async verify(reference) {
    try {
      const response = await this.makeRequest(`/transaction/verify/${reference}`);

      const { data } = response;

      const verificationResult = {
        success: data.status === 'success',
        reference: data.reference,
        amount: data.amount / 100,
        currency: data.currency,
        paidAt: data.paid_at,
        channel: data.channel,
        cardType: data.authorization?.card_type,
        bank: data.authorization?.bank,
        last4: data.authorization?.last4,
        expiry: data.authorization?.exp_month && data.authorization?.exp_year
          ? `${data.authorization.exp_month}/${data.authorization.exp_year}`
          : null,
        reusable: data.authorization?.reusable || false,
        customerEmail: data.customer?.email,
        customerCode: data.customer?.customer_code,
        metadata: data.metadata,
        gatewayResponse: data.gateway_response,
        fees: data.fees / 100,
        ipAddress: data.ip_address,
        id: data.id,
        domain: data.domain,
        status: data.status,
        createdAt: data.created_at,
      };

      logger.info(`✅ Transaction verified: ${reference} - ${data.status}`);

      return verificationResult;
    } catch (error) {
      logger.error(`Paystack verification error for ${reference}:`, error);
      throw error;
    }
  }

  /**
   * Create a transfer recipient
   * @param {string} name - Account name
   * @param {string} accountNumber - Account number
   * @param {string} bankCode - Bank code
   * @param {string} currency - Currency (NGN, GHS, USD)
   * @returns {Promise<object>} Recipient data
   */
  async createRecipient(name, accountNumber, bankCode, currency = 'NGN') {
    try {
      const body = {
        type: 'nuban',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency,
      };

      const response = await this.makeRequest('/transferrecipient', 'POST', body);

      logger.info(`👤 Transfer recipient created: ${response.data.recipient_code}`);

      return {
        recipientCode: response.data.recipient_code,
        name: response.data.name,
        accountNumber: response.data.details.account_number,
        bankName: response.data.details.bank_name,
        bankCode: response.data.details.bank_code,
        type: response.data.type,
        currency: response.data.currency,
        isActive: response.data.active,
        createdAt: response.data.created_at,
      };
    } catch (error) {
      logger.error('Paystack create recipient error:', error);
      throw error;
    }
  }

  /**
   * Update a transfer recipient
   * @param {string} recipientCode - Recipient code
   * @param {string} name - New account name
   * @param {string} email - New email
   */
  async updateRecipient(recipientCode, name, email) {
    try {
      const body = {};
      if (name) body.name = name;
      if (email) body.email = email;

      const response = await this.makeRequest(`/transferrecipient/${recipientCode}`, 'PUT', body);

      logger.info(`👤 Transfer recipient updated: ${recipientCode}`);

      return response.data;
    } catch (error) {
      logger.error('Paystack update recipient error:', error);
      throw error;
    }
  }

  /**
   * Delete a transfer recipient
   * @param {string} recipientCode - Recipient code
   */
  async deleteRecipient(recipientCode) {
    try {
      const response = await this.makeRequest(`/transferrecipient/${recipientCode}`, 'DELETE');

      logger.info(`🗑️ Transfer recipient deleted: ${recipientCode}`);

      return response.data;
    } catch (error) {
      logger.error('Paystack delete recipient error:', error);
      throw error;
    }
  }

  /**
   * Initiate a transfer
   * @param {number} amount - Amount in kobo
   * @param {string} recipientCode - Recipient code
   * @param {string} reason - Transfer reason
   * @returns {Promise<object>} Transfer data
   */
  async transfer(amount, recipientCode, reason = 'Payout') {
    try {
      const body = {
        source: 'balance',
        amount,
        recipient: recipientCode,
        reason: reason.substring(0, 100),
        currency: 'NGN',
      };

      const response = await this.makeRequest('/transfer', 'POST', body);

      logger.info(`💸 Transfer initiated: ${response.data.transfer_code}`);

      return {
        transferCode: response.data.transfer_code,
        reference: response.data.reference,
        status: response.data.status,
        amount: response.data.amount / 100,
        currency: response.data.currency,
        recipient: response.data.recipient,
        reason: response.data.reason,
        createdAt: response.data.created_at,
      };
    } catch (error) {
      logger.error('Paystack transfer error:', error);
      throw error;
    }
  }

  /**
   * Initiate a bulk transfer
   * @param {Array} transfers - Array of transfer objects
   * @param {string} currency - Currency (NGN, GHS)
   */
  async bulkTransfer(transfers, currency = 'NGN') {
    try {
      const body = {
        source: 'balance',
        transfers,
        currency,
      };

      const response = await this.makeRequest('/transfer/bulk', 'POST', body);

      logger.info(`💸 Bulk transfer initiated: ${transfers.length} transfers`);

      return response.data;
    } catch (error) {
      logger.error('Paystack bulk transfer error:', error);
      throw error;
    }
  }

  /**
   * Verify a transfer
   * @param {string} transferCode - Transfer code
   * @returns {Promise<object>} Transfer verification
   */
  async verifyTransfer(transferCode) {
    try {
      const response = await this.makeRequest(`/transfer/verify/${transferCode}`);

      return {
        success: response.data.status === 'success',
        status: response.data.status,
        amount: response.data.amount / 100,
        recipient: response.data.recipient,
        transferredAt: response.data.transferred_at,
        transferCode: response.data.transfer_code,
        reference: response.data.reference,
      };
    } catch (error) {
      logger.error('Paystack transfer verification error:', error);
      throw error;
    }
  }

  /**
   * Finalize a transfer (OTP required for large amounts)
   * @param {string} transferCode - Transfer code
   * @param {string} otp - OTP code
   */
  async finalizeTransfer(transferCode, otp) {
    try {
      const body = { transfer_code: transferCode, otp };

      const response = await this.makeRequest('/transfer/finalize_transfer', 'POST', body);

      logger.info(`✅ Transfer finalized: ${transferCode}`);

      return response.data;
    } catch (error) {
      logger.error('Paystack finalize transfer error:', error);
      throw error;
    }
  }

  /**
   * Resend transfer OTP
   * @param {string} transferCode - Transfer code
   * @param {string} reason - Reason for resend
   */
  async resendTransferOTP(transferCode, reason = 'resend_otp') {
    try {
      const body = { transfer_code: transferCode, reason };

      const response = await this.makeRequest('/transfer/resend_otp', 'POST', body);

      logger.info(`📱 Transfer OTP resent: ${transferCode}`);

      return response.data;
    } catch (error) {
      logger.error('Paystack resend OTP error:', error);
      throw error;
    }
  }

  /**
   * List banks
   * @param {string} country - Country code (nigeria, ghana)
   * @param {boolean} useCursor - Use cursor pagination
   * @returns {Promise<Array>} List of banks
   */
  async listBanks(country = 'nigeria', useCursor = false) {
    try {
      let endpoint = `/bank?country=${country}`;
      if (useCursor) endpoint += '&use_cursor=true';

      const response = await this.makeRequest(endpoint);

      return response.data.map(bank => ({
        id: bank.id,
        code: bank.code,
        name: bank.name,
        slug: bank.slug,
        longCode: bank.longcode,
        gateway: bank.gateway,
        payWithBank: bank.pay_with_bank || false,
        supportsTransfer: bank.active || false,
        country: bank.country,
        currency: bank.currency,
        type: bank.type,
        isActive: bank.active,
        createdAt: bank.created_at,
        updatedAt: bank.updated_at,
      }));
    } catch (error) {
      logger.error('Paystack list banks error:', error);
      throw error;
    }
  }

  /**
   * Resolve account number
   * @param {string} accountNumber - Account number
   * @param {string} bankCode - Bank code
   * @returns {Promise<object>} Account details
   */
  async resolveAccount(accountNumber, bankCode) {
    try {
      const response = await this.makeRequest(
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
      );

      logger.info(`🔍 Account resolved: ${accountNumber} - ${bankCode}`);

      return {
        accountName: response.data.account_name,
        accountNumber: response.data.account_number,
        bankId: response.data.bank_id,
      };
    } catch (error) {
      logger.error('Paystack resolve account error:', error);
      throw error;
    }
  }

  /**
   * Validate bank account with BVN
   * @param {string} bankCode - Bank code
   * @param {string} accountNumber - Account number
   * @param {string} bvn - BVN number
   * @param {string} firstName - First name
   * @param {string} lastName - Last name
   */
  async validateAccount(bankCode, accountNumber, bvn, firstName, lastName) {
    try {
      const body = {
        bank_code: bankCode,
        account_number: accountNumber,
        bvn,
        first_name: firstName,
        last_name: lastName,
      };

      const response = await this.makeRequest('/bank/validate', 'POST', body);

      logger.info(`✅ Account validated: ${accountNumber}`);

      return {
        verified: response.data.verified,
        accountName: response.data.account_name,
      };
    } catch (error) {
      logger.error('Paystack validate account error:', error);
      throw error;
    }
  }

  /**
   * Verify BVN
   * @param {string} bvn - BVN number
   */
  async verifyBvn(bvn) {
    try {
      const response = await this.makeRequest(`/bank/verify_bvn/${bvn}`);

      return response.data;
    } catch (error) {
      logger.error('Paystack verify BVN error:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @param {string} body - Request body string
   * @param {string} signature - x-paystack-signature header
   * @returns {boolean} Is valid
   */
  verifyWebhookSignature(body, signature) {
    if (!this.webhookSecret) {
      logger.warn('Webhook secret not configured');
      return false;
    }

    try {
      const hash = crypto
        .createHmac('sha512', this.webhookSecret)
        .update(body)
        .digest('hex');

      return hash === signature;
    } catch (error) {
      logger.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Create a subaccount (for marketplace splits)
   * @param {object} subaccountData - Subaccount details
   * @returns {Promise<object>} Subaccount data
   */
  async createSubaccount(subaccountData) {
    try {
      const body = {
        business_name: subaccountData.businessName,
        settlement_bank: subaccountData.bankCode,
        account_number: subaccountData.accountNumber,
        percentage_charge: subaccountData.percentageCharge || 0,
        primary_contact_email: subaccountData.email,
        primary_contact_name: subaccountData.contactName,
        primary_contact_phone: subaccountData.phone,
      };

      if (subaccountData.metadata) {
        body.metadata = subaccountData.metadata;
      }

      const response = await this.makeRequest('/subaccount', 'POST', body);

      logger.info(`🏢 Subaccount created: ${response.data.subaccount_code}`);

      return {
        subaccountCode: response.data.subaccount_code,
        businessName: response.data.business_name,
        settlementBank: response.data.settlement_bank,
        accountNumber: response.data.account_number,
        percentageCharge: response.data.percentage_charge,
        isActive: response.data.active,
        createdAt: response.data.created_at,
      };
    } catch (error) {
      logger.error('Paystack create subaccount error:', error);
      throw error;
    }
  }

  /**
   * List subaccounts
   * @param {number} perPage - Items per page
   * @param {number} page - Page number
   */
  async listSubaccounts(perPage = 50, page = 1) {
    try {
      const response = await this.makeRequest(`/subaccount?perPage=${perPage}&page=${page}`);

      return {
        subaccounts: response.data,
        total: response.meta.total,
        page: response.meta.page,
        pageCount: response.meta.pageCount,
      };
    } catch (error) {
      logger.error('Paystack list subaccounts error:', error);
      throw error;
    }
  }

  /**
   * Create a payment page
   * @param {string} name - Page name
   * @param {string} description - Page description
   * @param {number} amount - Amount in kobo
   */
  async createPaymentPage(name, description, amount) {
    try {
      const body = { name, description, amount };

      const response = await this.makeRequest('/page', 'POST', body);

      return {
        id: response.data.id,
        name: response.data.name,
        slug: response.data.slug,
        paymentUrl: `https://paystack.com/pay/${response.data.slug}`,
        amount: response.data.amount / 100,
        createdAt: response.data.created_at,
      };
    } catch (error) {
      logger.error('Paystack create payment page error:', error);
      throw error;
    }
  }

  /**
   * Get transaction fees
   * @param {number} amount - Amount in kobo
   * @param {string} currency - Currency code
   * @returns {Promise<object>} Fee breakdown
   */
  async getTransactionFee(amount, currency = 'NGN') {
    try {
      if (currency === 'NGN') {
        const percentageFee = Math.ceil(amount * 0.015);
        const flatFee = 10000;
        const cap = 200000;
        let totalFee = percentageFee + flatFee;

        if (totalFee > cap) totalFee = cap;

        return {
          percentageFee: percentageFee / 100,
          flatFee: flatFee / 100,
          totalFee: totalFee / 100,
          amountAfterFee: (amount - totalFee) / 100,
          cap: cap / 100,
        };
      }

      if (currency === 'GHS') {
        const percentageFee = Math.ceil(amount * 0.0195);
        const flatFee = 100;
        let totalFee = percentageFee + flatFee;

        return {
          percentageFee: percentageFee / 100,
          flatFee: flatFee / 100,
          totalFee: totalFee / 100,
          amountAfterFee: (amount - totalFee) / 100,
        };
      }

      return {
        percentageFee: 0,
        flatFee: 0,
        totalFee: 0,
        amountAfterFee: amount / 100,
      };
    } catch (error) {
      logger.error('Paystack get transaction fee error:', error);
      throw error;
    }
  }

  /**
   * Check Paystack balance
   * @returns {Promise<object>} Balance information
   */
  async getBalance() {
    try {
      const response = await this.makeRequest('/balance');

      return response.data.map(balance => ({
        currency: balance.currency,
        balance: balance.balance / 100,
      }));
    } catch (error) {
      logger.error('Paystack get balance error:', error);
      throw error;
    }
  }

  /**
   * Get total amount received
   * @param {string} period - day, week, month, year
   * @returns {Promise<object>} Total received
   */
  async getTotalReceived(period = 'month') {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('period', period);

      const response = await this.makeRequest(`/settlement?${queryParams.toString()}`);

      return {
        totalTransactions: response.data.total_transactions,
        totalVolume: response.data.total_volume,
        settledAmount: response.data.settled_amount,
        pendingAmount: response.data.pending_amount,
      };
    } catch (error) {
      logger.error('Paystack get total received error:', error);
      throw error;
    }
  }

  /**
   * List transactions
   * @param {object} filters - Filter parameters
   */
  async listTransactions(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.perPage) queryParams.append('perPage', filters.perPage);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.customer) queryParams.append('customer', filters.customer);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.from) queryParams.append('from', new Date(filters.from).toISOString());
      if (filters.to) queryParams.append('to', new Date(filters.to).toISOString());

      const response = await this.makeRequest(`/transaction?${queryParams.toString()}`);

      return {
        transactions: response.data.map(tx => ({
          id: tx.id,
          reference: tx.reference,
          amount: tx.amount / 100,
          status: tx.status,
          customer: tx.customer,
          channel: tx.channel,
          currency: tx.currency,
          createdAt: tx.created_at,
          paidAt: tx.paid_at,
        })),
        total: response.meta.total,
        page: response.meta.page,
        pageCount: response.meta.pageCount,
      };
    } catch (error) {
      logger.error('Paystack list transactions error:', error);
      throw error;
    }
  }

  /**
   * Fetch a single transaction by ID
   * @param {number} id - Transaction ID
   */
  async fetchTransaction(id) {
    try {
      const response = await this.makeRequest(`/transaction/${id}`);

      return {
        id: response.data.id,
        reference: response.data.reference,
        amount: response.data.amount / 100,
        status: response.data.status,
        customer: response.data.customer,
        metadata: response.data.metadata,
        channel: response.data.channel,
        createdAt: response.data.created_at,
        paidAt: response.data.paid_at,
      };
    } catch (error) {
      logger.error('Paystack fetch transaction error:', error);
      throw error;
    }
  }

  /**
   * Export transactions
   * @param {object} filters - Filter parameters
   */
  async exportTransactions(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.from) queryParams.append('from', new Date(filters.from).toISOString());
      if (filters.to) queryParams.append('to', new Date(filters.to).toISOString());
      if (filters.settled) queryParams.append('settled', filters.settled);

      const response = await this.makeRequest(`/transaction/export?${queryParams.toString()}`);

      return {
        exportUrl: response.data.path,
        expiresAt: response.data.expires_at,
      };
    } catch (error) {
      logger.error('Paystack export transactions error:', error);
      throw error;
    }
  }

  /**
   * Charge authorization (recurring payment)
   * @param {string} email - Customer email
   * @param {number} amount - Amount in kobo
   * @param {string} authorizationCode - Authorization code from previous transaction
   */
  async chargeAuthorization(email, amount, authorizationCode) {
    try {
      const body = {
        email,
        amount,
        authorization_code: authorizationCode,
      };

      const response = await this.makeRequest('/transaction/charge_authorization', 'POST', body);

      logger.info(`💳 Recurring charge: ${response.data.reference}`);

      return {
        reference: response.data.reference,
        status: response.data.status,
        amount: response.data.amount / 100,
        channel: response.data.channel,
      };
    } catch (error) {
      logger.error('Paystack charge authorization error:', error);
      throw error;
    }
  }

  /**
   * Check authorization
   * @param {string} authorizationCode - Authorization code
   * @param {string} email - Customer email
   * @param {number} amount - Amount in kobo
   */
  async checkAuthorization(authorizationCode, email, amount) {
    try {
      const body = {
        authorization_code: authorizationCode,
        email,
        amount,
      };

      const response = await this.makeRequest('/transaction/check_authorization', 'POST', body);

      return response.data;
    } catch (error) {
      logger.error('Paystack check authorization error:', error);
      throw error;
    }
  }
}

const paystackService = new PaystackService();
module.exports = paystackService;
