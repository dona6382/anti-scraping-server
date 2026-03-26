import { CidrUtils } from './cidr.utils';

describe('CidrUtils', () => {
  describe('isInRange', () => {
    it('192.168.1.5 in 192.168.1.0/24 → true', () => {
      expect(CidrUtils.isInRange('192.168.1.5', '192.168.1.0/24')).toBe(true);
    });

    it('192.168.2.5 in 192.168.1.0/24 → false', () => {
      expect(CidrUtils.isInRange('192.168.2.5', '192.168.1.0/24')).toBe(false);
    });

    it('10.0.0.1 in 10.0.0.0/8 → true', () => {
      expect(CidrUtils.isInRange('10.0.0.1', '10.0.0.0/8')).toBe(true);
    });

    it('10.255.255.255 in 10.0.0.0/8 → true', () => {
      expect(CidrUtils.isInRange('10.255.255.255', '10.0.0.0/8')).toBe(true);
    });

    it('11.0.0.1 in 10.0.0.0/8 → false', () => {
      expect(CidrUtils.isInRange('11.0.0.1', '10.0.0.0/8')).toBe(false);
    });

    it('172.16.0.1 in 172.16.0.0/16 → true', () => {
      expect(CidrUtils.isInRange('172.16.0.1', '172.16.0.0/16')).toBe(true);
    });

    it('exact match with /32 → true', () => {
      expect(CidrUtils.isInRange('1.2.3.4', '1.2.3.4/32')).toBe(true);
    });

    it('different IP with /32 → false', () => {
      expect(CidrUtils.isInRange('1.2.3.5', '1.2.3.4/32')).toBe(false);
    });

    it('any IP in 0.0.0.0/0 → true', () => {
      expect(CidrUtils.isInRange('123.45.67.89', '0.0.0.0/0')).toBe(true);
    });

    it('invalid IP returns false', () => {
      expect(CidrUtils.isInRange('not-an-ip', '192.168.0.0/24')).toBe(false);
    });

    it('invalid CIDR returns false', () => {
      expect(CidrUtils.isInRange('192.168.1.1', 'invalid')).toBe(false);
    });

    it('CIDR with prefix > 32 returns false', () => {
      expect(CidrUtils.isInRange('192.168.1.1', '192.168.1.0/33')).toBe(false);
    });
  });

  describe('isInAnyRange', () => {
    it('IP in one of multiple ranges → true', () => {
      const cidrs = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
      expect(CidrUtils.isInAnyRange('192.168.1.5', cidrs)).toBe(true);
    });

    it('IP in first range → true', () => {
      const cidrs = ['10.0.0.0/8', '172.16.0.0/12'];
      expect(CidrUtils.isInAnyRange('10.1.2.3', cidrs)).toBe(true);
    });

    it('IP not in any range → false', () => {
      const cidrs = ['10.0.0.0/8', '172.16.0.0/12'];
      expect(CidrUtils.isInAnyRange('8.8.8.8', cidrs)).toBe(false);
    });

    it('empty ranges → false', () => {
      expect(CidrUtils.isInAnyRange('192.168.1.1', [])).toBe(false);
    });
  });

  describe('isValidCidr', () => {
    it('valid CIDR formats', () => {
      expect(CidrUtils.isValidCidr('192.168.0.0/24')).toBe(true);
      expect(CidrUtils.isValidCidr('172.16.0.0/16')).toBe(true);
      expect(CidrUtils.isValidCidr('255.255.255.255/32')).toBe(true);
    });

    it('prefix < 16 rejected (too broad)', () => {
      expect(CidrUtils.isValidCidr('0.0.0.0/0')).toBe(false);
      expect(CidrUtils.isValidCidr('10.0.0.0/8')).toBe(false);
      expect(CidrUtils.isValidCidr('10.0.0.0/15')).toBe(false);
      expect(CidrUtils.isValidCidr('172.16.0.0/16')).toBe(true);
    });

    it('missing prefix → false', () => {
      expect(CidrUtils.isValidCidr('192.168.0.0')).toBe(false);
    });

    it('invalid prefix → false', () => {
      expect(CidrUtils.isValidCidr('192.168.0.0/33')).toBe(false);
      expect(CidrUtils.isValidCidr('192.168.0.0/-1')).toBe(false);
      expect(CidrUtils.isValidCidr('192.168.0.0/abc')).toBe(false);
    });

    it('invalid IP octets → false', () => {
      expect(CidrUtils.isValidCidr('256.0.0.0/24')).toBe(false);
      expect(CidrUtils.isValidCidr('192.168.0/24')).toBe(false);
      expect(CidrUtils.isValidCidr('abc.def.ghi.jkl/24')).toBe(false);
    });

    it('empty string → false', () => {
      expect(CidrUtils.isValidCidr('')).toBe(false);
    });
  });
});
