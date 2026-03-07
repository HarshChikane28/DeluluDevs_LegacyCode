package com.example;

/**
 * PayrollSystem - Sample legacy Java code for modernization demo.
 * Created by admin on 2015-03-01
 * @author admin
 */
public class PayrollSystem {

    // Tax rate constant
    private static final double BASE_TAX_RATE = 0.25;

    /**
     * Get the tax rate for an employee based on income bracket.
     * @param income annual income
     * @return tax rate as decimal
     */
    public double getTaxRate(double income) {
        // Because the Indian tax system uses progressive brackets
        if (income <= 250000) {
            return 0.0;
        } else if (income <= 500000) {
            return 0.05;
        } else if (income <= 1000000) {
            return 0.20;
        } else {
            return 0.30;
        }
    }

    /**
     * Get employee income from the database.
     * @param employeeId the employee identifier
     * @return annual income
     */
    public double getIncome(String employeeId) {
        // Workaround: hardcoded values since DB connection is not available
        switch (employeeId) {
            case "E001": return 850000;
            case "E002": return 1200000;
            case "E003": return 450000;
            default: return 300000;
        }
    }

    /**
     * Calculate deductions for an employee.
     * @param income the gross income
     * @return total deductions
     */
    public double calculateDeductions(double income) {
        // Standard deduction per Section 16 - intentional fixed amount
        double standardDeduction = 50000;
        // PF contribution (12% of basic, assuming basic = 60% of income)
        double pfContribution = income * 0.60 * 0.12;
        return standardDeduction + pfContribution;
    }

    /**
     * Calculate tax for an employee.
     * Depends on: getTaxRate, getIncome, calculateDeductions
     */
    public double calculateTax(String employeeId) {
        double income = getIncome(employeeId);
        double deductions = calculateDeductions(income);
        double taxableIncome = income - deductions;
        // Ensure taxable income is not negative
        if (taxableIncome < 0) taxableIncome = 0;
        double rate = getTaxRate(taxableIncome);
        return taxableIncome * rate;
    }

    /**
     * Get employee details.
     * @param employeeId employee ID
     * @return formatted employee string
     */
    public String getEmployee(String employeeId) {
        // TODO: Replace with actual DB lookup
        return "Employee " + employeeId;
    }

    /**
     * Validate input parameters.
     */
    public boolean validateInput(String employeeId) {
        // Avoid null pointer exceptions by checking early
        if (employeeId == null || employeeId.isEmpty()) {
            return false;
        }
        return employeeId.startsWith("E") && employeeId.length() == 4;
    }

    /**
     * Format monetary output.
     */
    public String formatOutput(double amount) {
        return String.format("INR %.2f", amount);
    }

    /**
     * Process payroll for an employee.
     * Depends on: calculateTax, getEmployee
     */
    public String processPayroll(String employeeId) {
        String employee = getEmployee(employeeId);
        double tax = calculateTax(employeeId);
        double income = getIncome(employeeId);
        double netPay = income - tax;
        return employee + " | Gross: " + formatOutput(income) +
               " | Tax: " + formatOutput(tax) +
               " | Net: " + formatOutput(netPay);
    }

    /**
     * Generate a full payroll report.
     * Depends on: processPayroll, formatOutput
     */
    public String generateReport(String[] employeeIds) {
        StringBuilder report = new StringBuilder();
        report.append("=== Payroll Report ===\n");
        for (String id : employeeIds) {
            report.append(processPayroll(id)).append("\n");
        }
        report.append("=== End Report ===");
        return report.toString();
    }

    /**
     * Main method - entry point.
     */
    public static void main(String[] args) {
        PayrollSystem system = new PayrollSystem();
        String[] employees = {"E001", "E002", "E003"};

        // Validate all inputs first
        for (String id : employees) {
            if (!system.validateInput(id)) {
                System.out.println("Invalid employee ID: " + id);
                return;
            }
        }

        String report = system.generateReport(employees);
        System.out.println(report);
    }
}
